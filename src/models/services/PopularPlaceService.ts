import { supabase } from '@/config/supabase';
import { PopularPlace } from '@/config/constants';

// Database row shape for public.popular_places (migration 018).
export interface PlaceRow {
  id: string;
  name: string;
  address: string | null;
  category: string;
  icon: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  details: string | null;
  sort_order: number;
  is_active: boolean;
}

const toPlace = (r: PlaceRow): PopularPlace => ({
  id: r.id,
  name: r.name,
  address: r.address || '',
  category: r.category,
  icon: r.icon,
  lat: r.latitude,
  lng: r.longitude,
  image: r.image_url || '',
  details: r.details || undefined,
  isActive: r.is_active,
  sortOrder: r.sort_order,
});

export class PopularPlaceService {
  // Active places for passengers — exactly what the admin has added and marked
  // visible. Returns an empty list when none exist (no hardcoded fallback).
  async listActive(): Promise<PopularPlace[]> {
    try {
      const { data, error } = await supabase
        .from('popular_places')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []).map(toPlace);
    } catch (e) {
      console.warn('popular_places fetch failed:', e);
      return [];
    }
  }

  // Every place (including inactive) for the admin console.
  async listAll(): Promise<PopularPlace[]> {
    const { data, error } = await supabase
      .from('popular_places')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data || []).map(toPlace);
  }

  async create(input: Partial<PlaceRow>): Promise<PopularPlace> {
    const { data, error } = await supabase.from('popular_places').insert(input).select().single();
    if (error) throw error;
    return toPlace(data);
  }

  async update(id: string, input: Partial<PlaceRow>): Promise<PopularPlace> {
    const { data, error } = await supabase
      .from('popular_places')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return toPlace(data);
  }

  // Deletes the row and confirms it actually went (a silent 0-row result under
  // RLS means the caller isn't an admin).
  async remove(id: string): Promise<void> {
    const { data, error } = await supabase.from('popular_places').delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data || !data.length) {
      throw new Error('The place could not be deleted. You may not have admin permission.');
    }
  }
}
