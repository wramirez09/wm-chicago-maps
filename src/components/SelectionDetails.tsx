import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {ApiError} from '../api/client';
import {useArrivals, usePlace} from '../api/hooks';

/**
 * Which live data a selected feature should load.
 *
 * Business ownership and park details were removed with the third-party
 * clients they depended on. Arrivals need a stop id on the feature: layers
 * that have one pass `arrivals`, and those that do not simply show nothing.
 */
export type LiveDetail =
  | {kind: 'place'; id: string}
  | {kind: 'arrivals'; stop: string; mode: 'rail' | 'bus' | 'metra'};

type Props = {detail: LiveDetail};

export function SelectionDetails({detail}: Props) {
  switch (detail.kind) {
    case 'place':
      return <PlaceDetails id={detail.id} />;
    case 'arrivals':
      return <ArrivalDetails stop={detail.stop} mode={detail.mode} />;
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

/** How many departures fit on the card before it crowds the map. */
const MAX_ARRIVALS = 4;

/**
 * What to say when a stop cannot answer.
 *
 * Every one of these is reachable today, and none of them is the user's
 * problem, so all three read as a missing feed rather than a failure:
 *
 *   400  the mode has no live feed at all — Metra arrivals are not built yet.
 *        Permanent for now, so it is worded as a gap, not a hiccup.
 *   502  the backend reached the tracker and it refused. This is what rail and
 *        bus return until the CTA keys are set as Fly secrets.
 *   0    no network, which the rest of the card already survives.
 */
function arrivalsNote(error: unknown, mode: 'rail' | 'bus' | 'metra'): string {
  if (error instanceof ApiError && error.statusCode === 400) {
    return mode === 'metra'
      ? 'Live arrivals for Metra are not available yet.'
      : 'Live arrivals are not available for this stop.';
  }
  return 'Arrivals unavailable right now.';
}

/**
 * Next departures from a stop, from GET /v1/transit/arrivals.
 *
 * The hook refetches every 30 s, so the card stays current while it is open.
 * A scheduled time (`live: false`) is marked, because a timetable minute and a
 * tracked minute are worth different amounts when you are deciding to run.
 *
 * The card never throws on a failed feed: arrivals are one section of it, and
 * a stop's name, routes and directions are still worth showing without them.
 */
function ArrivalDetails({stop, mode}: {stop: string; mode: 'rail' | 'bus' | 'metra'}) {
  const arrivals = useArrivals(stop, mode);

  if (arrivals.isLoading) {
    return <Loading />;
  }
  if (arrivals.isError || !arrivals.data) {
    return <Note>{arrivalsNote(arrivals.error, mode)}</Note>;
  }
  if (arrivals.data.arrivals.length === 0) {
    return <Note>No departures scheduled.</Note>;
  }

  return (
    <Section title="Next departures">
      {arrivals.data.arrivals.slice(0, MAX_ARRIVALS).map(arrival => (
        <Line key={`${arrival.route}-${arrival.destination}-${arrival.arrivesAt}`}>
          {`${arrival.route} to ${arrival.destination} · ${formatMinutes(arrival.minutes)}`}
          {arrival.delayed ? ' · delayed' : ''}
          {arrival.live ? '' : ' · scheduled'}
        </Line>
      ))}
    </Section>
  );
}

/** "Due" reads better than "0 min" for something pulling in now. */
function formatMinutes(minutes: number) {
  if (minutes <= 0) {
    return 'Due';
  }
  return `${minutes} min`;
}

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
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
  line: {fontSize: 13, lineHeight: 18, color: '#374151'},
  note: {marginTop: 8, fontSize: 12, color: '#6b7280'},
  loading: {paddingTop: 10, alignItems: 'flex-start'},
});
