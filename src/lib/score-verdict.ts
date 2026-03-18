export function getVisaVerdict(score: number): string {
  if (score >= 85) return "Approved (Strong)";
  if (score >= 75) return "Approved (Pass)";
  if (score >= 60) return "221g";
  if (score >= 45) return "Refused";
  return "Refused (Critical)";
}
