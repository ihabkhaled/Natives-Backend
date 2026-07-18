import type { AgeClassification } from '../model/members.enums';
import { MemberAudience, MemberViewTier } from '../model/members.enums';
import type {
  MemberProfile,
  MemberRecord,
  MemberView,
  ViewerContext,
} from '../model/members.types';

/**
 * Pure field-level privacy serializer. Given a member record, the viewer's tier,
 * and whether the viewer is the member themselves, it produces the shaped view —
 * redacting every field the audience is not permitted to see. Five distinct
 * shapes are produced: public, teammate, self, coach, admin. No permissions are
 * evaluated here (that is the application layer's job); this maps a resolved
 * viewer context to a safe projection. Golden field-matrix tests cover it fully.
 */

interface Visibility {
  readonly teammate: boolean;
  readonly personal: boolean;
  readonly ownDob: boolean;
  readonly admin: boolean;
}

function visibilityFor(viewer: ViewerContext): Visibility {
  const isCoachOrAdmin =
    viewer.tier === MemberViewTier.Coach ||
    viewer.tier === MemberViewTier.Admin;
  const isTeammatePlus =
    isCoachOrAdmin || viewer.tier === MemberViewTier.Teammate;
  return {
    teammate: isTeammatePlus || viewer.isSelf,
    personal: isCoachOrAdmin || viewer.isSelf,
    ownDob: viewer.tier === MemberViewTier.Admin || viewer.isSelf,
    admin: viewer.tier === MemberViewTier.Admin,
  };
}

/** The distinct audience label a shaped view was rendered for. */
export function resolveAudienceLabel(viewer: ViewerContext): MemberAudience {
  if (viewer.tier === MemberViewTier.Admin) {
    return MemberAudience.Admin;
  }
  if (viewer.tier === MemberViewTier.Coach) {
    return MemberAudience.Coach;
  }
  if (viewer.isSelf) {
    return MemberAudience.Self;
  }
  if (viewer.tier === MemberViewTier.Teammate) {
    return MemberAudience.Teammate;
  }
  return MemberAudience.Public;
}

function publicDisplayName(profile: MemberProfile): string {
  return profile.preferredName ?? profile.fullName;
}

type PublicFields = Pick<
  MemberView,
  | 'membershipId'
  | 'teamId'
  | 'status'
  | 'displayName'
  | 'nickname'
  | 'positions'
  | 'jerseyNumber'
  | 'division'
  | 'hasAvatar'
>;

function baseFields(record: MemberRecord): PublicFields {
  const { profile, membership } = record;
  return {
    membershipId: membership.id,
    teamId: membership.teamId,
    status: membership.status,
    displayName: publicDisplayName(profile),
    nickname: profile.nickname,
    positions: profile.positions,
    jerseyNumber: profile.jerseyNumber,
    division: profile.division,
    hasAvatar: profile.avatarMediaId !== null,
  };
}

type TeammateFields = Pick<
  MemberView,
  'preferredName' | 'fullNameAr' | 'gender'
>;

function teammateFields(profile: MemberProfile, v: Visibility): TeammateFields {
  return {
    preferredName: v.teammate ? profile.preferredName : null,
    fullNameAr: v.teammate ? profile.fullNameAr : null,
    gender: v.teammate ? profile.gender : null,
  };
}

type PersonalFields = Pick<
  MemberView,
  | 'fullName'
  | 'jerseySize'
  | 'email'
  | 'phone'
  | 'heightCm'
  | 'weightKg'
  | 'ageClassification'
>;

function personalFields(
  profile: MemberProfile,
  v: Visibility,
  ageClassification: AgeClassification | null,
): PersonalFields {
  return {
    fullName: v.personal ? profile.fullName : null,
    jerseySize: v.personal ? profile.jerseySize : null,
    email: v.personal ? profile.email : null,
    phone: v.personal ? profile.phone : null,
    heightCm: v.personal ? profile.heightCm : null,
    weightKg: v.personal ? profile.weightKg : null,
    ageClassification: v.personal ? ageClassification : null,
  };
}

type SensitiveFields = Pick<
  MemberView,
  'dateOfBirth' | 'statusReason' | 'createdBy' | 'updatedBy' | 'version'
>;

function sensitiveFields(record: MemberRecord, v: Visibility): SensitiveFields {
  const { profile, membership } = record;
  return {
    dateOfBirth: v.ownDob ? profile.dateOfBirth : null,
    statusReason: v.admin ? membership.statusReason : null,
    createdBy: v.admin ? profile.createdBy : null,
    updatedBy: v.admin ? profile.updatedBy : null,
    version: v.admin ? profile.version : null,
  };
}

/** Shape a member record for a resolved viewer, redacting disallowed fields. */
export function shapeMemberView(
  record: MemberRecord,
  viewer: ViewerContext,
  ageClassification: AgeClassification | null,
): MemberView {
  const v = visibilityFor(viewer);
  return {
    ...baseFields(record),
    audience: resolveAudienceLabel(viewer),
    ...teammateFields(record.profile, v),
    ...personalFields(record.profile, v, ageClassification),
    ...sensitiveFields(record, v),
  };
}
