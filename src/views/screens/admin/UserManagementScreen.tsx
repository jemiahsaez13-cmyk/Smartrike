import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Surface, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, shadows } from '@/views/styles/theme';

const mockUsers = [
  { id: '1', name: 'Juan Dela Cruz', type: 'Driver', status: 'Active', email: 'juan@toda.com' },
  { id: '2', name: 'Maria Santos', type: 'Passenger', status: 'Active', email: 'maria@mail.com' },
  { id: '3', name: 'Pedro Penduko', type: 'Driver', status: 'Pending', email: 'pedro@toda.com' },
];

export const UserManagementScreen = () => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Operations</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textLight} style={styles.searchIcon} />
          <TextInput 
            placeholder="Search by name, email, or ID..."
            placeholderTextColor={colors.textLight}
            style={styles.searchInput}
            mode="flat"
            underlineColor="transparent"
            activeUnderlineColor="transparent"
          />
        </View>
        <Surface style={styles.filterBtn} elevation={1}>
          <MaterialCommunityIcons name="filter-variant" size={20} color={colors.text} />
        </Surface>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.tableCount}>Showing 3 records</Text>

        {mockUsers.map((user) => (
          <Surface key={user.id} style={styles.userRow} elevation={0}>
            <View style={styles.userInfo}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarInitial}>{user.name.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
            </View>
            
            <View style={styles.metaInfo}>
              <View style={[
                styles.roleBadge, 
                { backgroundColor: user.type === 'Driver' ? colors.primaryLight : '#F1F5F9' }
              ]}>
                <Text style={[
                  styles.roleText, 
                  { color: user.type === 'Driver' ? colors.primaryDark : colors.textSecondary }
                ]}>{user.type}</Text>
              </View>
              <MaterialCommunityIcons name="dots-horizontal" size={20} color={colors.textLight} style={{ marginLeft: 12 }} />
            </View>
          </Surface>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    paddingHorizontal: spacing.lg, 
    paddingTop: 60, 
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: 0 },
  searchContainer: { 
    flexDirection: 'row', 
    paddingHorizontal: spacing.lg, 
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  searchBar: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F1F5F9', 
    borderRadius: 8, 
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, backgroundColor: 'transparent', height: 44, fontSize: 14 },
  filterBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg },
  tableCount: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.md },
  userRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: spacing.md, 
    backgroundColor: colors.surface, 
    borderRadius: 12, 
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  userName: { fontSize: 15, fontWeight: '700', color: colors.text },
  userEmail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  metaInfo: { flexDirection: 'row', alignItems: 'center' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  roleText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }
});
