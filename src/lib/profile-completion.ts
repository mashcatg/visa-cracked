export interface ProfileData {
  whatsapp_number?: string | null;
  facebook_url?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  visa_country?: string | null;
  visa_type?: string | null;
}

export interface FormFieldData {
  field_key: string;
  is_required: boolean;
}

export interface UserFormData {
  field_key: string;
  field_value: string | null;
}

function isFilled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

const REQUIRED_BASE_FIELDS: Array<keyof ProfileData> = ["whatsapp_number", "visa_country", "visa_type"];

/**
 * Returns true when all required profile fields are filled.
 * Required = base required fields + visa_type_form_fields where is_required=true.
 */
export function hasCompletedRequiredProfileFields(
  profile: ProfileData,
  formFields: FormFieldData[],
  userFormData: UserFormData[]
): boolean {
  const missingBase = REQUIRED_BASE_FIELDS.some((field) => !isFilled(profile[field]));
  if (missingBase) return false;

  const requiredVisaFields = formFields.filter((field) => field.is_required);
  return requiredVisaFields.every((field) => {
    const userData = userFormData.find((d) => d.field_key === field.field_key);
    return isFilled(userData?.field_value);
  });
}

/**
 * Completion percentage based only on required fields.
 * Includes base required profile fields and required dynamic visa fields.
 */
export function calculateRequiredProfileCompletion(
  profile: ProfileData,
  formFields: FormFieldData[],
  userFormData: UserFormData[]
): number {
  const requiredVisaFields = formFields.filter((field) => field.is_required);
  const totalRequired = REQUIRED_BASE_FIELDS.length + requiredVisaFields.length;
  if (totalRequired === 0) return 100;

  const completedBase = REQUIRED_BASE_FIELDS.filter((field) => isFilled(profile[field])).length;
  const completedVisa = requiredVisaFields.filter((field) => {
    const userData = userFormData.find((d) => d.field_key === field.field_key);
    return isFilled(userData?.field_value);
  }).length;

  return Math.round(((completedBase + completedVisa) / totalRequired) * 100);
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
  if (isFilled(profile.whatsapp_number)) score += 15;
  if (isFilled(profile.facebook_url)) score += 5;
  if (isFilled(profile.linkedin_url)) score += 5;
  if (isFilled(profile.instagram_url)) score += 5;

  // Visa Details (70%)
  if (formFields.length > 0) {
    const filledCount = formFields.filter((field) => {
      const userData = userFormData.find((d) => d.field_key === field.field_key);
      return isFilled(userData?.field_value);
    }).length;
    const ratio = filledCount / formFields.length;
    score += Math.round(ratio * 70);
  }
  // If no form fields configured, give full 70% if whatsapp is filled (basic profile)
  else {
    if (isFilled(profile.whatsapp_number)) score += 70;
  }

  return Math.min(100, Math.round(score));
}
