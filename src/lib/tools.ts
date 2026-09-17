// Tools Hub data. Links verified directly against the rendered DOM of
// https://lbs-hub.vercel.app/tools (fetched and inspected, not guessed).
// Descriptions are the source page's own copy. Its "YOUR LINKS" section is
// per-browser personal bookmarks, not shared content, so it's excluded.

export const TOOL_CATEGORIES = [
  "Academic",
  "Admin",
  "Career",
  "Collaboration",
  "Library & Research",
  "Productivity",
  "Student Life",
  "Personal",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export interface ToolLink {
  id: string;
  title: string;
  description?: string;
  href: string;
  category: ToolCategory;
  icon?: string;
  /** Defaults to true — every current entry is an external LBS/partner site. */
  external?: boolean;
  tags?: string[];
}

export const TOOLS: ToolLink[] = [
  {
    id: "canvas",
    title: "Canvas",
    description: "Course pages — readings, slides, assignments, grades.",
    href: "https://learning.london.edu/",
    category: "Academic",
    icon: "📚",
  },
  {
    id: "lbs-outlook",
    title: "LBS Outlook",
    description: "School email + your Outlook calendar.",
    href: "https://outlook.office.com/",
    category: "Collaboration",
    icon: "📧",
  },
  {
    id: "mylbs",
    title: "MyLBS",
    description:
      "The LBS community app — news, events, people directory. Also available on iOS and Android.",
    href: "https://mylbs.london.edu/",
    category: "Student Life",
    icon: "🏫",
    tags: ["Web", "iOS", "Android"],
  },
  {
    id: "meet",
    title: "Meet",
    description: "Meet and connect with other LBS students.",
    href: "https://meetlbs.london.edu/login",
    category: "Student Life",
    icon: "🤝",
  },
  {
    id: "campusgroups",
    title: "CampusGroups",
    description: "Every club — memberships, events, tickets.",
    href: "https://clubs.london.edu/",
    category: "Student Life",
    icon: "🎟️",
  },
  {
    id: "book-a-room",
    title: "Book a room",
    description: "Study and meeting rooms on campus.",
    href: "https://lbsmobile.london.edu/index.html#bookings",
    category: "Admin",
    icon: "🗓️",
  },
  {
    id: "library-az",
    title: "Library A–Z",
    description: "Every research database the library licenses.",
    href: "https://library.london.edu/az/databases",
    category: "Library & Research",
    icon: "📖",
  },
  {
    id: "printing",
    title: "Printing",
    description: "How to print on campus — opens in Canvas.",
    href: "https://learning.london.edu/courses/12655/pages/printing",
    category: "Admin",
    icon: "🖨️",
  },
  {
    id: "seats",
    title: "Seats",
    description: "Attendance tracker.",
    href: "https://lbs.seats.cloud/angular/#/",
    category: "Admin",
    icon: "✅",
  },
  {
    id: "talkcampus",
    title: "TalkCampus",
    description: "Anonymous peer support for wellbeing, 24/7.",
    href: "https://www.talkcampus.com/",
    category: "Personal",
    icon: "💬",
  },
  {
    id: "unidays",
    title: "UNiDAYS",
    description: "Student discounts — clothes, tech, food, travel.",
    href: "https://www.myunidays.com/GB/en-GB",
    category: "Personal",
    icon: "🏷️",
  },
  {
    id: "student-beans",
    title: "Student Beans",
    description: "The other one. Different shops, so worth having both.",
    href: "https://www.studentbeans.com/uk",
    category: "Personal",
    icon: "🌱",
  },
  {
    id: "career-portal-plus",
    title: "Career Portal Plus",
    description: "Job postings, applications, coach bookings (12twenty).",
    href: "https://lbs.12twenty.com/",
    category: "Career",
    icon: "💼",
  },
  {
    id: "vmock",
    title: "VMock",
    description: "Instant AI feedback on your CV + LinkedIn.",
    href: "https://www.vmock.com/lbs",
    category: "Career",
    icon: "🎯",
  },
];
