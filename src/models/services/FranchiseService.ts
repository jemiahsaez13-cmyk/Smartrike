import { supabase } from '@/config/supabase';
import {
  FranchiseApplication,
  FranchiseEvent,
  FranchiseEventType,
  FranchiseRecordStatus,
  FranchiseStatus,
  PublicDriverFranchise,
  SuccessorRelationship,
} from '@/models/entities/Franchise';

export interface RecordFranchiseEventInput {
  eventType: FranchiseEventType;
  effectiveDate?: string;
  toHolder?: string;
  relationship?: SuccessorRelationship | 'third_party';
  reason?: string;
  qualifiedRecipient?: boolean;
  newExpiryDate?: string;
  agreementNumber?: string;
  agreementText?: string;
  createdBy?: string | null;
}

const validISODate = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

export class FranchiseService {
  async getByDriver(driverId: string): Promise<FranchiseApplication | null> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return this.withDerivedRecordStatus(data[0]);
  }

  async getAll(): Promise<FranchiseApplication[]> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /** Issued/registered franchises used by the association registry. */
  async getRegistry(): Promise<FranchiseApplication[]> {
    const rows = await this.getAll();
    return rows
      .filter((row) => row.status === 'issued' || !!row.mtop_number)
      .map((row) => this.withDerivedRecordStatus(row));
  }

  async getEvents(franchiseId?: string): Promise<FranchiseEvent[]> {
    let query = supabase
      .from('franchise_events')
      .select('*')
      .order('effective_date', { ascending: false });
    if (franchiseId) query = query.eq('franchise_id', franchiseId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as FranchiseEvent[];
  }

  /**
   * Records renewals, succession, third-party transfers, and terminations.
   * Eligibility is enforced here for immediate feedback and again by the
   * database constraints/policies in migration 035.
   */
  async recordEvent(
    application: FranchiseApplication,
    input: RecordFranchiseEventInput
  ): Promise<{ application: FranchiseApplication; event: FranchiseEvent }> {
    const effectiveDate = input.effectiveDate || new Date().toISOString().slice(0, 10);
    if (!validISODate(effectiveDate)) throw new Error('Use YYYY-MM-DD for the effective date.');
    const fromHolder = application.current_holder_name || application.driver_name;
    const patch: Partial<FranchiseApplication> = {};

    if (input.eventType === 'renewal') {
      if (!input.newExpiryDate) throw new Error('Enter the renewed franchise expiry date.');
      if (!validISODate(input.newExpiryDate)) throw new Error('Use YYYY-MM-DD for the renewed expiry date.');
      if (input.newExpiryDate < effectiveDate) throw new Error('The renewed expiry must be after the renewal date.');
      patch.franchise_status = 'active';
      patch.type = 'renewal';
      patch.last_renewed_at = effectiveDate;
      patch.renewal_year = new Date(`${effectiveDate}T00:00:00`).getFullYear();
      patch.expiry_date = input.newExpiryDate;
    } else if (input.eventType === 'succession_transfer') {
      if (!input.toHolder?.trim()) throw new Error('Enter the eligible successor’s full name.');
      if (input.relationship !== 'spouse' && input.relationship !== 'unmarried_eldest_child') {
        throw new Error('Succession is limited to an eligible spouse or unmarried eldest child.');
      }
      patch.current_holder_name = input.toHolder.trim();
      patch.franchise_status = 'transferred';
    } else if (input.eventType === 'third_party_transfer') {
      if (!input.toHolder?.trim()) throw new Error('Enter the qualified buyer or transferee.');
      if (!input.qualifiedRecipient) throw new Error('Confirm that the third party meets TODA/LGU qualifications.');
      patch.current_holder_name = input.toHolder.trim();
      patch.franchise_status = 'transferred';
    } else if (input.eventType === 'termination') {
      if (!input.reason?.trim()) throw new Error('A termination reason is required.');
      patch.franchise_status = 'terminated';
      patch.remarks = input.reason.trim();
    }

    const updated = await this.patch(application.id, patch);
    const { data, error } = await supabase
      .from('franchise_events')
      .insert({
        franchise_id: application.id,
        event_type: input.eventType,
        from_holder: fromHolder,
        to_holder: input.toHolder?.trim() || null,
        relationship: input.relationship || null,
        reason: input.reason?.trim() || null,
        effective_date: effectiveDate,
        agreement_number: input.agreementNumber || null,
        agreement_text: input.agreementText || null,
        created_by: input.createdBy || null,
      })
      .select()
      .single();
    if (error) throw error;
    return { application: this.withDerivedRecordStatus(updated), event: data as FranchiseEvent };
  }

  async updateRegistryDetails(
    id: string,
    details: {
      bodyNumber: string;
      expiryDate?: string;
      currentHolderName?: string;
      franchiseStatus?: FranchiseRecordStatus;
    }
  ): Promise<FranchiseApplication> {
    if (!details.bodyNumber.trim()) throw new Error('Tricycle body number is required.');
    if (details.expiryDate && !validISODate(details.expiryDate)) {
      throw new Error('Use YYYY-MM-DD for the franchise expiry date.');
    }
    return this.patch(id, {
      body_number: details.bodyNumber.trim().toUpperCase(),
      expiry_date: details.expiryDate || null,
      current_holder_name: details.currentHolderName?.trim() || undefined,
      franchise_status: details.franchiseStatus,
    });
  }

  /** Public, privacy-safe fields displayed to the matched passenger. */
  async getPublicDriverFranchise(driverId: string): Promise<PublicDriverFranchise | null> {
    const { data, error } = await supabase.rpc('get_driver_public_franchise', {
      p_driver_id: driverId,
    });
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) return row as PublicDriverFranchise;
    }

    // Offline/mock fallback. Real deployments use the privacy-safe RPC above.
    const own = await this.getByDriver(driverId);
    if (!own || (own.status !== 'issued' && !own.mtop_number)) return null;
    const derived = this.withDerivedRecordStatus(own);
    return {
      driver_id: derived.driver_id,
      mtop_number: derived.mtop_number,
      body_number: derived.body_number ?? null,
      plate_number: derived.plate_number ?? null,
      franchise_status: derived.franchise_status ?? 'active',
      current_holder_name: derived.current_holder_name ?? derived.driver_name,
      expiry_date: derived.expiry_date ?? null,
      last_renewed_at: derived.last_renewed_at ?? null,
      renewal_year: derived.renewal_year ?? null,
    };
  }

  private withDerivedRecordStatus(application: FranchiseApplication): FranchiseApplication {
    const hasExpired = !!application.expiry_date
      && new Date(`${application.expiry_date}T23:59:59`).getTime() < Date.now();
    const protectedStatuses: FranchiseRecordStatus[] = ['terminated', 'transferred', 'pending_renewal'];
    const current = application.franchise_status ?? (application.status === 'issued' ? 'active' : null);
    return {
      ...application,
      franchise_status: hasExpired && current && !protectedStatuses.includes(current)
        ? 'expired'
        : current,
    };
  }

  async submit(application: Partial<FranchiseApplication>): Promise<FranchiseApplication> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('franchise_applications')
      .insert({
        ...application,
        status: 'submitted',
        inspection_result: 'pending',
        payment_status: 'pending',
        mtop_number: null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateStatus(
    id: string,
    status: FranchiseStatus,
    patch: Partial<FranchiseApplication> = {}
  ): Promise<FranchiseApplication> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .update({ status, ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Patches arbitrary fields (e.g. document review state) without forcing a
  // lifecycle status change — used by the admin document review flow.
  async patch(
    id: string,
    patch: Partial<FranchiseApplication>
  ): Promise<FranchiseApplication> {
    const { data, error } = await supabase
      .from('franchise_applications')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
