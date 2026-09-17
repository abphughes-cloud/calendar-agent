// Phase 1 placeholder data for the Academic To-Do list. Phase 2 will
// replace this with real Canvas/Outlook-sourced tasks.

export const TASK_BUCKETS = ["Today", "This Week", "Needs Review", "Later"] as const;
export type TaskBucket = (typeof TASK_BUCKETS)[number];

export type TaskSource = "Canvas" | "Outlook" | "Manual";
export type TaskPriority = "Low" | "Medium" | "High";
export type TaskStatus = "Not started" | "In progress" | "Done";

export interface DemoTask {
  title: string;
  source: TaskSource;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  bucket: TaskBucket;
  course?: string;
}

export const DEMO_TASKS: DemoTask[] = [
  {
    title: "Submit Corporate Finance problem set 3",
    source: "Canvas",
    dueDate: "Today, 11:59pm",
    priority: "High",
    status: "In progress",
    bucket: "Today",
    course: "Corporate Finance",
  },
  {
    title: "Reply to study group re: case prep",
    source: "Outlook",
    dueDate: "Today, 6:00pm",
    priority: "Medium",
    status: "Not started",
    bucket: "Today",
  },
  {
    title: "Read HBS case for Strategy",
    source: "Canvas",
    dueDate: "Thursday",
    priority: "Medium",
    status: "Not started",
    bucket: "This Week",
    course: "Strategy",
  },
  {
    title: "Book 1:1 with career coach",
    source: "Manual",
    dueDate: "Friday",
    priority: "Low",
    status: "Not started",
    bucket: "This Week",
  },
  {
    title: "Confirm marketing group presentation slot",
    source: "Outlook",
    dueDate: "Unconfirmed",
    priority: "Medium",
    status: "Not started",
    bucket: "Needs Review",
    course: "Marketing",
  },
  {
    title: "Double-check Operations grade query",
    source: "Canvas",
    dueDate: "Unconfirmed",
    priority: "Low",
    status: "Not started",
    bucket: "Needs Review",
    course: "Operations",
  },
  {
    title: "Start Leadership reflection essay",
    source: "Canvas",
    dueDate: "Next week",
    priority: "Low",
    status: "Not started",
    bucket: "Later",
    course: "Leadership",
  },
  {
    title: "Plan summer internship applications",
    source: "Manual",
    dueDate: "Next month",
    priority: "Medium",
    status: "Not started",
    bucket: "Later",
  },
];
