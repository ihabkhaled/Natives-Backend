import { MembershipStatus } from '@modules/members';

import type { RosterPlayer, StaffTitleDefinition } from './seed-roster.types';

/**
 * The real Ultimate Natives roster, from the owner-supplied "NATIVES T-SHIRT
 * NUMBERS" sheet. These are rostered players, not application users: each gets
 * a membership and a member profile, and NO user account or credential. A
 * player who later needs to sign in is invited through the normal invitation
 * flow, which links their account to the membership already sitting here.
 */
export const ROSTER_MEMBERSHIP_STATUS = MembershipStatus.Active;

/**
 * Shirt numbers are strings, not integers: they are printed labels that can
 * carry a leading zero (Mahmoud Nasr wears "011", which is not 11).
 *
 * Lina is seeded without a number: the sheet gives her 2, which Medo Khalil
 * already wears, and the per-team uniqueness index allows only one. Left blank
 * rather than guessed, pending confirmation.
 */
export const ROSTER_PLAYERS: readonly RosterPlayer[] = [
  // Two different people share the name Sherif Ashraf; the nickname is what
  // distinguishes them, so it is part of this seeder's identity check.
  {
    key: '3alamy',
    fullName: 'Sherif Ashraf',
    nickname: '3alamy',
    jersey: '33',
  },
  {
    key: 'khaled-o',
    fullName: 'Khaled O',
    nickname: 'Khaled O.',
    jersey: '66',
  },
  { key: 'rawan-e', fullName: 'Rawan E', nickname: 'Rou', jersey: '11' },
  { key: 'somaia-e', fullName: 'Somaia E', nickname: 'Sou', jersey: '28' },
  {
    key: 'moustafa-abdelmeotaal',
    fullName: 'Moustafa Abdelmeotaal',
    nickname: 'Si3a',
    jersey: '8',
  },
  {
    key: 'usama-zakaria',
    fullName: 'Usama Zakaria',
    nickname: 'Uzo',
    jersey: '1',
  },
  {
    key: 'israa-hassan',
    fullName: 'Israa Hassan',
    nickname: 'Divaa',
    jersey: '12',
  },
  {
    key: 'adham-hawwas',
    fullName: 'Adham Hawwas',
    nickname: 'Domaa',
    jersey: '55',
  },
  {
    key: 'omar-assem',
    fullName: 'Omar Assem',
    nickname: 'Bernie',
    jersey: '14',
  },
  {
    key: 'zahra-moustafa',
    fullName: 'Zahra Moustafa',
    nickname: 'Zahra',
    jersey: '22',
  },
  {
    key: 'abdelrahman-eliemy',
    fullName: 'Abdelrahman Eliemy',
    nickname: 'Eleimy',
    jersey: '47',
  },
  { key: 'fawzy', fullName: 'Fawzy', nickname: 'Fawzy', jersey: '77' },
  {
    key: 'ahmed-esssam-jr',
    fullName: 'Ahmed Esssam Jr',
    nickname: 'Avocado',
    jersey: '25',
  },
  {
    key: 'mohamed-ezzat',
    fullName: 'Mohamed Ezzat',
    nickname: 'Ezzat',
    jersey: '20',
  },
  {
    key: 'assem-sheweta',
    fullName: 'Assem Sheweta',
    nickname: 'Sheweta',
    jersey: '18',
  },
  { key: 'mina-emad', fullName: 'Mina Emad', nickname: 'Mina', jersey: '0' },
  {
    key: 'medo-khalil',
    fullName: 'Medo Khalil',
    nickname: 'Medo',
    jersey: '2',
  },
  {
    key: 'mohamed-elsayed',
    fullName: 'Mohamed Elsayed',
    nickname: 'El Sayed',
    jersey: '30',
  },
  {
    key: 'sherif-ashraf',
    fullName: 'Sherif Ashraf',
    nickname: 'Nemo',
    jersey: '10',
  },
  {
    key: 'esraa-elemary',
    fullName: 'Esraa Elemary',
    nickname: 'Emari',
    jersey: '24',
  },
  // See the null-jersey note above.
  {
    key: 'mahmoud-nasr',
    fullName: 'Mahmoud Nasr',
    nickname: 'Hoodz',
    jersey: '011',
  },
  {
    key: 'mohamed-khaled',
    fullName: 'Mohamed Khaled',
    nickname: 'Mesho',
    jersey: '5',
  },
  {
    key: 'mustafa-mekkawy',
    fullName: 'Mustafa Mekkawy',
    nickname: 'Mekkawy',
    jersey: '94',
  },
  {
    key: 'ziyad-elgendy',
    fullName: 'Ziyad Elgendy',
    nickname: 'Zizo',
    jersey: '9',
  },
  { key: 'roaa-nasr', fullName: 'Roaa Nasr', nickname: 'Roaa', jersey: '4' },
  {
    key: 'nourane-elsayed',
    fullName: 'Nourane Elsayed',
    nickname: 'Nouran',
    jersey: '23',
  },
  {
    key: 'ahmed-essam-sin',
    fullName: 'Ahmed Essam Sin',
    nickname: 'Essam',
    jersey: '99',
  },
  { key: 'hala', fullName: 'Hala', nickname: 'Hala', jersey: '42' },
  { key: 'waad', fullName: 'Waad', nickname: 'Weedy', jersey: '7' },
  // See the null-jersey note above.
  // Medo Khalil already wears 2; Lina's number is left blank pending confirmation.
  { key: 'lina', fullName: 'Lina', nickname: 'Lilo', jersey: null },
  { key: 'manar', fullName: 'Manar', nickname: 'Mani', jersey: '13' },
];

/**
 * The staff-title catalog, seeded as `reference_catalog_entries` under the
 * `staff_title` catalog so titles stay extensible without a parallel table.
 */
export const STAFF_TITLE_CATALOG = 'staff_title';

export const STAFF_TITLES: readonly StaffTitleDefinition[] = [
  { key: 'coach', label: 'Coach', position: 1 },
  { key: 'co-coach', label: 'Co-Coach', position: 2 },
  { key: 'spirit-captain', label: 'Spirit Captain', position: 3 },
  { key: 'finance', label: 'Finance', position: 4 },
  { key: 'social-media', label: 'Social Media & Marketing', position: 5 },
  { key: 'analysis', label: 'Analysis', position: 6 },
  { key: 'technical', label: 'Technical', position: 7 },
];

/**
 * Season Board 26-27 responsibilities, keyed to the roster above.
 *
 * The titles here deliberately differ from the words printed on the Season
 * Board graphics: the owner's instruction is that the card reading "CAPTAIN"
 * is the team's Coach and "CO CAPTAIN" is a Co-Coach. Use these, never the
 * image captions.
 *
 * Ihab Khaled holds titles without appearing on the shirt-number sheet, so he
 * gets a membership from here rather than from ROSTER_PLAYERS.
 */
export const STAFF_ASSIGNMENTS: readonly {
  readonly playerKey: string;
  readonly titleKeys: readonly string[];
  readonly photoUrl: string | null;
}[] = [
  {
    playerKey: '3alamy',
    titleKeys: ['coach'],
    photoUrl: '/staff/sherif-ashraf.jpg',
  },
  {
    playerKey: 'khaled-o',
    titleKeys: ['co-coach'],
    photoUrl: '/staff/khaled-ossama.jpg',
  },
  {
    playerKey: 'rawan-e',
    titleKeys: ['co-coach'],
    photoUrl: '/staff/rawan-elessawy.jpg',
  },
  {
    playerKey: 'zahra-moustafa',
    titleKeys: ['spirit-captain'],
    photoUrl: '/staff/zahra.jpg',
  },
  {
    playerKey: 'abdelrahman-eliemy',
    titleKeys: ['finance'],
    photoUrl: '/staff/abdelrahman-elleimy.jpg',
  },
  {
    playerKey: 'nourane-elsayed',
    titleKeys: ['social-media'],
    photoUrl: '/staff/nourane.jpg',
  },
  {
    playerKey: 'lina',
    titleKeys: ['social-media'],
    photoUrl: '/staff/lina.jpg',
  },
  {
    playerKey: 'roaa-nasr',
    titleKeys: ['social-media'],
    photoUrl: '/staff/roaa.jpg',
  },
  {
    playerKey: 'ihab-khaled',
    titleKeys: ['analysis', 'technical'],
    photoUrl: '/staff/ihab-khaled.jpg',
  },
];

/** Holds staff titles but is not on the shirt-number sheet. */
export const STAFF_ONLY_MEMBERS: readonly RosterPlayer[] = [
  {
    key: 'ihab-khaled',
    fullName: 'Ihab Khaled',
    nickname: 'Hobz',
    jersey: null,
  },
];

export const TEAM_MISSING_MESSAGE =
  'Team "un" is missing. Run the "team-ultimate-natives" seeder before seeding the roster.';
export const MEMBERSHIP_INSERT_FAILED_MESSAGE =
  'Roster membership insert did not return an id';
export const CATALOG_INSERT_FAILED_MESSAGE =
  'Staff title catalog entry insert did not return an id';
