export interface Chapter {
  id: string;
  title: string;
}

export interface Subject {
  name: string;
  chapters: Chapter[];
}

export const syllabusData: Subject[] = [
  {
    name: "Mathematics",
    chapters: [
      { id: "12.1", title: "Chapter 12.1" },
      { id: "12.2", title: "Chapter 12.2" },
      { id: "12.3", title: "Chapter 12.3" },
      { id: "12.4", title: "Chapter 12.4" },
      { id: "14", title: "Chapter 14" },
      { id: "16.3", title: "Chapter 16.3" },
      { id: "16.4", title: "Chapter 16.4" },
      { id: "11.1", title: "Chapter 11.1 (Revision)" },
      { id: "11.2", title: "Chapter 11.2 (Revision)" },
      { id: "8.6-11", title: "Chapter 8 (Construction 6-11) Revision" },
      { id: "8.5", title: "Exercise 8.5" },
    ],
  },
  {
    name: "Higher Mathematics",
    chapters: [
      { id: "8.3", title: "Chapter 8.3" },
      { id: "13", title: "Chapter 13" },
      { id: "7", title: "Chapter 7" },
    ],
  },
  {
    name: "Biology",
    chapters: [
      { id: "2", title: "Chapter 2 (Revision)" },
      { id: "3", title: "Chapter 3 (Revision)" },
      { id: "11", title: "Chapter 11 (New)" },
    ],
  },
  {
    name: "Islamic Studies",
    chapters: [
      { id: "2.24", title: "Chapter 2: Lesson 24" },
      { id: "3.12", title: "Chapter 3: Lesson 12" },
      { id: "3.13", title: "Chapter 3: Lesson 13" },
      { id: "4.15-22", title: "Chapter 4: Lessons 15–22" },
    ],
  },
  {
    name: "Physics",
    chapters: [
      { id: "6", title: "Chapter 06" },
      { id: "11", title: "Chapter 11" },
      { id: "12", title: "Chapter 12" },
      { id: "13", title: "Chapter 13" },
    ],
  },
  {
    name: "Bangladesh & Global Studies",
    chapters: [
      { id: "7", title: "Chapter 7 - The Organs of Bangladesh Government" },
      { id: "15", title: "Chapter 15 - Social Problems of Bangladesh" },
    ],
  },
  {
    name: "ICT",
    chapters: [
      { id: "5", title: "Chapter 5 (Graphics)" },
      { id: "6.8-9", title: "Chapter 6 (Exp 8-9)" },
    ],
  },
];
