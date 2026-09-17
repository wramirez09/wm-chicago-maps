import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {usePlace} from '../api/hooks';

/**
 * Which live data a selected feature should load.
 *
 * Only places have a detail endpoint today. Station arrivals, bus predictions,
 * business ownership and park details were removed with the third-party
 * clients they depended on: the API has /v1/transit/arrivals, but the
 * transit-stations layer carries no CTA stop id to call it with.
 */
export type LiveDetail = {kind: 'place'; id: string};

type Props = {detail: LiveDetail};

export function SelectionDetails({detail}: Props) {
  switch (detail.kind) {
    case 'place':
      return <PlaceDetails id={detail.id} />;
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
