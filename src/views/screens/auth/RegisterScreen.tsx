import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, typography, shadows } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';
import { TricycleIcon } from '@/views/components/common/TricycleIcon';

export const RegisterScreen = () => {
  const navigation = useNavigation<any>();

  const RoleCard = ({ title, description, icon, type, onPress }: any) => (
    <TouchableOpacity 
      activeOpacity={0.7} 
      onPress={onPress}
      style={styles.cardWrapper}
    >
      <Card style={styles.roleCard} variant="elevated" padding="lg">
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons 
            name={icon} 
            size={40} 
            color={type === 'passenger' ? colors.accent : colors.secondary} 
          />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDescription}>{description}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TricycleIcon size={40} color={colors.primary} />
        </View>

        {/* Intro */}
        <View style={styles.intro}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Select the type of account you want to create to get started.</Text>
        </View>

        {/* Roles */}
        <View style={styles.rolesContainer}>
          <RoleCard 
            title="Passenger" 
            description="Book rides and travel across the city safely."
            icon="account-group-outline"
            type="passenger"
            onPress={() => navigation.navigate('PassengerRegister')}
          />

          <RoleCard 
            title="Driver" 
            description="Join our team of drivers and start earning today."
            icon="moped"
            type="driver"
            onPress={() => navigation.navigate('DriverRegister')}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    justifyContent: 'center',
    alignItems: 'center',
  },
  intro: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  rolesContainer: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  cardWrapper: {
    width: '100%',
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceHover,
    borderRadius: 12,
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  cardTitle: {
    ...typography.h3,
    fontSize: 17,
  },
  cardDescription: {
    ...typography.bodySmall,
    marginTop: 2,
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  footerText: {
    ...typography.bodySmall,
  },
  loginLink: {
    ...typography.labelSmall,
    color: colors.accent,
    fontWeight: '700',
  },
});
