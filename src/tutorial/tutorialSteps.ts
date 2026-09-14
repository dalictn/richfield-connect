import type { UserRole } from '../types/auth';
import type { RootStackParamList } from '../navigation/RootNavigator';

export interface TutorialStep {
  tab: string;
  title: string;
  icon: string;
  /**
   * What the screen is for. This is context handed to the AI, which writes the
   * member-specific explanation; it is only shown verbatim if the AI is unavailable.
   */
  purpose: string;
}

export const SHELL_FOR_ROLE: Record<UserRole, keyof RootStackParamList> = {
  student: 'StudentShell',
  alumni: 'AlumniShell',
  business: 'BusinessShell',
  administrator: 'AdminShell',
};

export const ROLE_NAMES: Record<UserRole, string> = {
  student: 'current student',
  alumni: 'Richfield graduate',
  business: 'employer',
  administrator: 'platform administrator',
};

const STEPS: Record<UserRole, TutorialStep[]> = {
  student: [
    { tab: 'Dashboard', title: 'Your dashboard', icon: 'view-dashboard-outline', purpose: 'shows profile views, connections, applications and how your profile compares with others in your programme' },
    { tab: 'Portfolio', title: 'Your portfolio', icon: 'card-account-details-outline', purpose: 'is your digital portfolio of skills, projects, certifications and experience, with controls over who sees each section' },
    { tab: 'Connections', title: 'Connections', icon: 'account-group-outline', purpose: 'lets you find students, alumni and employers and grow your professional network' },
    { tab: 'Opportunities', title: 'Careers', icon: 'briefcase-outline', purpose: 'lists approved roles matched to your skills, institutional events, and the career pathways of alumni from your programme' },
    { tab: 'Feed', title: 'Your feed', icon: 'newspaper-variant-outline', purpose: 'is a professional feed ranked for your role, where you post updates and engage with your network' },
    { tab: 'Assistant', title: 'Your AI coach', icon: 'robot-happy-outline', purpose: 'is an AI profile coach you can ask at any time how to strengthen your profile and plan next steps' },
  ],
  alumni: [
    { tab: 'Dashboard', title: 'Your dashboard', icon: 'view-dashboard-outline', purpose: 'is your home on the alumni network' },
    { tab: 'Portfolio', title: 'Your portfolio', icon: 'card-account-details-outline', purpose: 'holds your career history, which appears in the career pathways current students explore' },
    { tab: 'Connections', title: 'Connections', icon: 'account-group-outline', purpose: 'lets you reconnect with classmates and support current students' },
    { tab: 'Opportunities', title: 'Careers', icon: 'briefcase-outline', purpose: 'shows institutional events and the career pathways where your own journey appears' },
    { tab: 'Feed', title: 'Your feed', icon: 'newspaper-variant-outline', purpose: 'is where you share career stories that help current students decide their direction' },
    { tab: 'Assistant', title: 'Your AI coach', icon: 'robot-happy-outline', purpose: 'is an AI assistant for improving your profile and how you present your experience' },
  ],
  business: [
    { tab: 'Dashboard', title: 'Hiring dashboard', icon: 'view-dashboard-outline', purpose: 'shows your applicant pipeline, listing engagement and the skills of Richfield candidates' },
    { tab: 'Opportunities', title: 'Post opportunities', icon: 'briefcase-outline', purpose: 'is where you post internships and graduate roles, which go live after administrator approval and are matched to students' },
    { tab: 'Connections', title: 'Find talent', icon: 'account-group-outline', purpose: 'lets you search verified Richfield students and alumni by skill' },
    { tab: 'Portfolio', title: 'Company profile', icon: 'card-account-details-outline', purpose: 'is your company profile, including the graduates and skills you are looking for' },
    { tab: 'Assistant', title: 'Your AI assistant', icon: 'robot-happy-outline', purpose: 'is an AI assistant for making your company profile and listings more attractive to graduates' },
  ],
  administrator: [
    { tab: 'Console', title: 'Administrator console', icon: 'shield-account-outline', purpose: 'is where you triage user approvals, opportunity approvals, moderation, events, analytics and broadcasts' },
    { tab: 'Feed', title: 'Community feed', icon: 'newspaper-variant-outline', purpose: 'shows what members are posting, so you can spot content that needs moderation' },
    { tab: 'Connections', title: 'Member directory', icon: 'account-group-outline', purpose: 'lets you look up any member of the network' },
    { tab: 'Assistant', title: 'AI assistant', icon: 'robot-happy-outline', purpose: 'is the same AI assistant members use, so you can see the guidance they receive' },
  ],
};

export function stepsFor(role: UserRole): TutorialStep[] {
  return STEPS[role] ?? STEPS.student;
}
