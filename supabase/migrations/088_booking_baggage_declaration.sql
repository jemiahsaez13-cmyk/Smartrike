-- =============================================================================
-- 088 · Baggage declaration on a booking (D3, no extra charge)
-- -----------------------------------------------------------------------------
--  The passenger says how many bags they bring and how big the biggest one is,
--  so the driver knows before accepting. It does NOT change the fare:
--  enforce_booking_insert (080) and route_change_fare (087) are untouched.
--
--  bookings.baggage_count  0–10 (0 = no baggage)
--  bookings.baggage_size   small / medium / large: size of the biggest item;
--                          NULL when there is no baggage
--
--  Apply after 087. Safe to run more than once.
-- =============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS baggage_count SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS baggage_size  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.bookings'::regclass
       AND conname = 'bookings_baggage_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_baggage_check
      CHECK (
        baggage_count BETWEEN 0 AND 10
        AND (baggage_size IS NULL OR baggage_size IN ('small', 'medium', 'large'))
        AND ((baggage_count = 0) = (baggage_size IS NULL))
      );
  END IF;
END;
$$;

COMMENT ON COLUMN public.bookings.baggage_count IS
  'D3 (088): bags the passenger declared at booking; 0 = none. No extra charge.';
COMMENT ON COLUMN public.bookings.baggage_size IS
  'D3 (088): size of the biggest bag (small / medium / large); NULL when baggage_count = 0.';

NOTIFY pgrst, 'reload schema';
