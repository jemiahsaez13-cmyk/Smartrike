import React from 'react';
import { View, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { Text, Surface, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows, typography, radius } from '@/views/styles/theme';
import { Card } from '@/views/components/common/Card';

const mockUsers = [
  { id: '1', name: 'Juan Dela Cruz', type: 'Driver', status: 'Active', email: 'juan@toda.com' },
  { id: '2', name: 'Maria Santos', type: 'Passenger', status: 'Active', email: 'maria@mail.com' },
  { id: '3', name: 'Pedro Penduko', type: 'Driver', status: 'Pending', email: 'pedro@toda.com' },
];

export const UserManagementScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Operations</Text>
        <Text style={styles.headerSubtitle}>Manage platform access and roles</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput 
            placeholder="Search name, email, or ID..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            mode="flat"
            underlineColor="transparent"
            activeUnderlineColor="transparent"
            dense
          />
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <MaterialCommunityIcons name="filter-variant" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.resultCount}>SHOWING {mockUsers.length} RECORDS</Text>

        {mockUsers.map((user) => (
          <Card key={user.id} variant="elevated" padding="md" style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarInitial}>{user.name.charAt(0)}</Text>
              </View>
              <View style={styles.details}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </View>
            
            <View style={styles.metaRow}>
              <View style={[
                styles.roleBadge, 
                { backgroundColor: user.type === 'Driver' ? colors.primaryLight : colors.surfaceAlt }
              ]}>
                <Text style={[
                  styles.roleText, 
                  { color: user.type === 'Driver' ? colors.primary : colors.textSecondary }
                ]}>{user.type}</Text>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: user.status === 'Active' ? colors.success : colors.warning }]} />
                <Text style={styles.statusText}>{user.status}</Text>
              </View>
              <TouchableOpacity style={styles.moreBtn}>
                <MaterialCommunityIcons name="dots-horizontal" size={20} color={colors.textLight} />
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: { 
    paddingHorizontal: spacing.screen, 
    paddingTop: spacing.lg, 
    paddingBottom: spacing.md,
  },
  headerTitle: { 
    ...typography.h1,
    fontSize: 28,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  searchContainer: { 
    flexDirection: 'row', 
    paddingHorizontal: spacing.screen, 
    paddingBottom: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  searchBar: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.surfaceAlt, 
    borderRadius: radius.md, 
    paddingHorizontal: spacing.md,
    height: 48
  },
  searchIcon: { 
    marginRight: spacing.sm 
  },
  searchInput: { 
    flex: 1, 
    backgroundColor: 'transparent', 
    height: 48, 
    fontSize: 14,
    ...typography.body,
  },
  filterBtn: { 
    width: 48, 
    height: 48, 
    borderRadius: radius.md, 
    backgroundColor: colors.surfaceAlt, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  scroll: { 
    flex: 1 
  },
  scrollContent: { 
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: 100 
  },
  resultCount: { 
    ...typography.labelSmall,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
    fontSize: 10,
  },
  userCard: { 
    marginBottom: spacing.md,
  },
  userInfo: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  avatarBox: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: colors.primary, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: spacing.md 
  },
  avatarInitial: { 
    color: '#fff', 
    fontSize: 18, 
    ...typography.h3,
  },
  details: {
    flex: 1,
  },
  userName: { 
    ...typography.label,
    fontSize: 16,
    color: colors.text 
  },
  userEmail: { 
    ...typography.bodySmall,
    color: colors.textSecondary, 
    marginTop: 2 
  },
  metaRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.md,
  },
  roleBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: radius.sm 
  },
  roleText: { 
    ...typography.labelSmall,
    fontSize: 10, 
    fontWeight: '800', 
    textTransform: 'uppercase' 
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    ...typography.bodySmall,
    fontSize: 12,
    color: colors.textSecondary,
  },
  moreBtn: {
    padding: 4,
  }
});
