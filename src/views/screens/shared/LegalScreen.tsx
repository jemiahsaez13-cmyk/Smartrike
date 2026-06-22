import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LEGAL } from '@/config/constants';
import { colors, layout, radius, spacing, typography } from '@/views/styles/theme';

type LegalType = keyof typeof LEGAL;

export const LegalScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const type: LegalType = route.params?.type === 'terms' ? 'terms' : 'privacy';
  const doc = LEGAL[type];

  return (
    <View style={styles.container}>
      {/* App bar */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>{doc.title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.docTitle}>{doc.title}</Text>
        <Text style={styles.updated}>{doc.updated}</Text>

        {doc.sections.map((section, i) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>
              {i + 1}. {section.heading}
            </Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}

        <Text style={styles.footer}>Smart Trike • FEDTODAB</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.screen,
    paddingTop: layout.headerTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarTitle: {
    ...typography.h3,
    fontSize: 18,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  docTitle: {
    ...typography.h1,
    fontSize: 26,
  },
  updated: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  heading: {
    ...typography.label,
    fontSize: 15,
    marginBottom: 6,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  footer: {
    ...typography.bodySmall,
    textAlign: 'center',
    color: colors.textLight,
    marginTop: spacing.sm,
  },
});
