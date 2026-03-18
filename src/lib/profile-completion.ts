export interface ProfileData {
  whatsapp_number?: string | null;
  facebook_url?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
}

export interface FormFieldData {
  field_key: string;
  is_required: boolean;
}

export interface UserFormData {
  field_key: string;
  field_value: string | null;
}

/**
 * Calculate profile completion percentage.
 * Social (30%): whatsapp 15%, facebook 5%, linkedin 5%, instagram 5%
 * Visa Details (70%): based on dynamic form fields filled
 */
export function calculateProfileCompletion(
  profile: ProfileData,
  formFields: FormFieldData[],
  userFormData: UserFormData[]
): number {
  let score = 0;

  // Social (30%)
  if (profile.whatsapp_number?.trim()) score += 15;
  if (profile.facebook_url?.trim()) score += 5;
  if (profile.linkedin_url?.trim()) score += 5;
  if (profile.instagram_url?.trim()) score += 5;

  // Visa Details (70%)
  if (formFields.length > 0) {
    const filledCount = formFields.filter((field) => {
      const userData = userFormData.find((d) => d.field_key === field.field_key);
      return userData?.field_value?.trim();
    }).length;
    const ratio = filledCount / formFields.length;
    score += Math.round(ratio * 70);
  }
  // If no form fields configured, give full 70% if whatsapp is filled (basic profile)
  else {
    if (profile.whatsapp_number?.trim()) score += 70;
  }

  return Math.min(100, Math.round(score));
}
