import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppSelector } from '@/controllers/store';
import { MessageService } from '@/models/services/MessageService';
import { supabase, isSupabaseConfigured } from '@/config/supabase';
import { colors } from '@/views/styles/theme';

const service = new MessageService();

interface Props {
  /** Icon tint — defaults to white for use on gradient headers. */
  color?: string;
  style?: ViewStyle;
}

/**
 * Header shortcut to the Messages inbox with a live unread badge. Refreshes on
 * focus and whenever a message row changes, so the count stays honest without
 * the user pulling to refresh.
 */
export const MessagesButton = ({ color = '#fff', style }: Props) => {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    try {
      setUnread(await service.getUnreadCount(user.id));
    } catch {
      /* leave the last known count */
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return;
    let channel: any;
    try {
      channel = supabase
        .channel(`unread_${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => refresh())
        .subscribe();
    } catch {
      /* realtime unavailable */
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch {
        /* noop */
      }
    };
  }, [user?.id, refresh]);

  return (
    <TouchableOpacity
      style={[styles.btn, style]}
      onPress={() => navigation.navigate('Inbox')}
      activeOpacity={0.8}
      accessibilityLabel="Messages"
    >
      <MaterialCommunityIcons name="message-text-outline" size={22} color={color} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
