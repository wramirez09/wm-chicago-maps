import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {KeyHint} from './KeyHint';
import {usePlace} from '../api/hooks';
import {hasEnv} from '../lib/api/env';
import {useParkEvents, useParkFacilities} from '../lib/api/neighborhoods/hooks';
import {useBusinessOwners, useParcelsByAddress} from '../lib/api/places/hooks';
import {nearestStation} from '../lib/api/transit/ctaStations';
import {useBusPredictions, useCtaStations, useTrainArrivals} from '../lib/api/transit/hooks';

/** Which live feed a selected feature should load. */
export type LiveDetail =
  | {kind: 'place'; id: string}
  | {kind: 'cta-station'; coordinates: [number, number]}
  | {kind: 'business'; accountNumber?: string; address?: string}
  | {kind: 'bus-stop'; stopId: string}
  | {kind: 'park'; parkNumber: string};

type Props = {detail: LiveDetail};

export function SelectionDetails({detail}: Props) {
  switch (detail.kind) {
    case 'place':
      return <PlaceDetails id={detail.id} />;
    case 'cta-station':
      return <TrainArrivals coordinates={detail.coordinates} />;
    case 'business':
      return <BusinessOwnership accountNumber={detail.accountNumber} address={detail.address} />;
    case 'bus-stop':
      return <BusPredictions stopId={detail.stopId} />;
    case 'park':
      return <ParkDetails parkNumber={detail.parkNumber} />;
  }
}

/**
 * The detail view for a tapped place. The card's title and subtitle come from
 * the PlaceSummary already on the map feature; this loads the rest.
 */
function PlaceDetails({id}: {id: string}) {
  const place = usePlace(id);

  if (place.isLoading) {
    return <Loading />;
  }
  if (place.isError || !place.data) {
    return <Note>Details unavailable right now.</Note>;
  }

  const {description, address, website, phone, independenceReason, vouchCount} = place.data;
  const hasContact = Boolean(address || website || phone);

  return (
    <>
      {description ? <Line>{description}</Line> : null}
      {hasContact ? (
        <Section title="Details">
          {address ? <Line>{address}</Line> : null}
          {phone ? <Line>{phone}</Line> : null}
          {website ? <Line>{website}</Line> : null}
        </Section>
      ) : null}
      {independenceReason || vouchCount > 0 ? (
        <Section title="Independence">
          {independenceReason ? <Line>{independenceReason}</Line> : null}
          {vouchCount > 0 ? (
            <Line>
              Vouched for by {vouchCount} {vouchCount === 1 ? 'person' : 'people'}
            </Line>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

function TrainArrivals({coordinates}: {coordinates: [number, number]}) {
  const keyed = hasEnv('CTA_TRAIN_KEY');
  // Resolving the mapid is keyless, so it runs regardless; only the arrivals
  // call needs the key.
  const stations = useCtaStations();
  const station = stations.data ? nearestStation(stations.data, coordinates) : null;
  const arrivals = useTrainArrivals(
    {mapId: station?.mapId, max: 6},
    {enabled: keyed && station !== null},
  );

  if (!keyed) {
    return <KeyHint feature="Live train arrivals" envKey="CTA_TRAIN_KEY" />;
  }
  if (stations.isLoading || arrivals.isLoading) {
    return <Loading />;
  }
  if (stations.data && !station) {
    return <Note>Couldn't match this stop to a CTA station.</Note>;
  }
  if (arrivals.isError) {
    return <Note>Arrivals unavailable right now.</Note>;
  }
  if (!arrivals.data || arrivals.data.length === 0) {
    return <Note>No trains predicted.</Note>;
  }

  return (
    <Section title="Next trains">
      {arrivals.data.map(a => (
        <Row
          key={`${a.runNumber}-${a.stopId}`}
          left={`${a.route} → ${a.destination}`}
          right={a.isApproaching ? 'Due' : `${a.minutesAway} min`}
          flag={a.isDelayed ? 'Delayed' : a.isScheduled ? 'Scheduled' : undefined}
        />
      ))}
    </Section>
  );
}

function BusPredictions({stopId}: {stopId: string}) {
  const keyed = hasEnv('CTA_BUS_KEY');
  const predictions = useBusPredictions([stopId], {enabled: keyed});

  if (!keyed) {
    return <KeyHint feature="Live bus predictions" envKey="CTA_BUS_KEY" />;
  }
  if (predictions.isLoading) {
    return <Loading />;
  }
  if (predictions.isError) {
    return <Note>Predictions unavailable right now.</Note>;
  }
  if (!predictions.data || predictions.data.length === 0) {
    return <Note>No buses predicted.</Note>;
  }

  return (
    <Section title="Next buses">
      {predictions.data.slice(0, 6).map(p => (
        <Row
          key={`${p.vehicleId}-${p.route}`}
          left={`${p.route} ${p.routeDirection} → ${p.destination}`}
          right={p.isDue ? 'Due' : `${p.minutesAway} min`}
          flag={p.isDelayed ? 'Delayed' : undefined}
        />
      ))}
    </Section>
  );
}

/**
 * Who owns the licence, and whether they appear to own the building. Both
 * keyless. The occupancy line is worded as a signal because it is one — see
 * `likelyOwnerOccupied` in cookCountyAssessor.ts for why it cannot be a fact.
 */
function BusinessOwnership({accountNumber, address}: {accountNumber?: string; address?: string}) {
  const owners = useBusinessOwners(accountNumber ?? null);
  const parcels = useParcelsByAddress(address ?? null);

  if (owners.isLoading || parcels.isLoading) {
    return <Loading />;
  }

  const names = [...new Set((owners.data ?? []).map(o => o.fullName).filter(Boolean))];
  const parcel = parcels.data?.[0];

  if (names.length === 0 && !parcel) {
    return null;
  }

  return (
    <Section title="Ownership">
      {names.length > 0 ? <Line>Licensed to {names.slice(0, 3).join(', ')}</Line> : null}
      {parcel ? (
        <Line>
          {parcel.likelyOwnerOccupied
            ? 'Owner receives mail at this address — possibly owner-occupied'
            : 'Building owner receives mail elsewhere'}
        </Line>
      ) : null}
    </Section>
  );
}

function ParkDetails({parkNumber}: {parkNumber: string}) {
  const facilities = useParkFacilities(parkNumber);
  const events = useParkEvents({parkNumber, limit: 5});

  if (facilities.isLoading || events.isLoading) {
    return <Loading />;
  }

  const upcoming = events.data ?? [];

  return (
    <>
      {facilities.data && facilities.data.length > 0 ? (
        <Section title="Facilities">
          <Line>{facilities.data.map(humanizeFacility).join(' · ')}</Line>
        </Section>
      ) : null}
      {upcoming.length > 0 ? (
        <Section title="Upcoming permits">
          {upcoming.map(event => (
            <Row
              key={event.id}
              left={event.title}
              right={event.startsAt ? event.startsAt.toLocaleDateString() : ''}
            />
          ))}
        </Section>
      ) : null}
    </>
  );
}

/**
 * The parks dataset's feature columns are shapefile-truncated to 10 chars
 * ("pool_indoo", "tennis_cou"). Mapped to readable names for the common ones;
 * anything unmapped is shown de-underscored rather than hidden.
 */
const FACILITY_NAMES: Record<string, string> = {
  playground: 'Playground',
  playgrou_1: 'Playground',
  pool_indoo: 'Indoor pool',
  pool_outdo: 'Outdoor pool',
  tennis_cou: 'Tennis',
  basketball: 'Basketball',
  baseball_b: 'Baseball',
  football_s: 'Football',
  dog_friend: 'Dog-friendly',
  gymnasium: 'Gym',
  fitness_ce: 'Fitness center',
  beach: 'Beach',
  garden: 'Garden',
  spray_feat: 'Spray pool',
  water_play: 'Water play',
  skate_park: 'Skate park',
  iceskating: 'Ice skating',
  harbor: 'Harbor',
};

function humanizeFacility(column: string): string {
  return FACILITY_NAMES[column] ?? column.replace(/_/g, ' ');
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({left, right, flag}: {left: string; right: string; flag?: string}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLeft} numberOfLines={1}>
        {left}
        {flag ? <Text style={styles.flag}>  {flag}</Text> : null}
      </Text>
      <Text style={styles.rowRight}>{right}</Text>
    </View>
  );
}

function Line({children}: {children: React.ReactNode}) {
  return <Text style={styles.line}>{children}</Text>;
}

function Note({children}: {children: React.ReactNode}) {
  return <Text style={styles.note}>{children}</Text>;
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="small" color="#9ca3af" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {marginTop: 10, gap: 4},
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {flexDirection: 'row', justifyContent: 'space-between', gap: 8},
  rowLeft: {flex: 1, fontSize: 13, color: '#111827'},
  rowRight: {fontSize: 13, fontWeight: '600', color: '#111827'},
  flag: {fontSize: 11, color: '#b45309', fontWeight: '600'},
  line: {fontSize: 13, lineHeight: 18, color: '#374151'},
  note: {marginTop: 8, fontSize: 12, color: '#6b7280'},
  loading: {paddingTop: 10, alignItems: 'flex-start'},
});
