-- Require a current driver's license with new and renewal MTOP applications.
CREATE OR REPLACE FUNCTION public.mtop_documents_are_approved(p_documents JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_typeof(p_documents) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(ARRAY[
        'Driver''s License',
        'Barangay Clearance',
        'Community Tax Certificate (Cedula)',
        'OR/CR of Tricycle Unit',
        'Proof of Ownership',
        'TODA Membership Certificate'
      ]) AS required(name)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_documents) AS document
        WHERE document->>'name' = required.name
          AND COALESCE((document->>'uploaded')::BOOLEAN, FALSE)
          AND document->>'review_status' = 'approved'
          AND COALESCE(document->>'file_url', '') <> ''
      )
    );
$$;
