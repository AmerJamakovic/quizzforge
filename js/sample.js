// sample.js, a hand-written sample quiz, seeded into the library on first run
// so every screen has data to work with (build order step 2).

export const SAMPLE_QUIZ = {
  schemaVersion: 1,
  id: 'q_sample01',
  title: 'Capitals of Europe',
  description: 'A short sample quiz to show how QuizForge works.',
  createdAt: '2026-06-10T12:00:00Z',
  updatedAt: '2026-06-10T12:00:00Z',
  settings: {
    questionsPerPage: 1,
    shuffleQuestions: false,
    shuffleChoices: false
  },
  questions: [
    {
      id: 'qq1',
      type: 'single',
      prompt: 'What is the capital of France?',
      choices: [
        { id: 'c1', text: 'Paris' },
        { id: 'c2', text: 'Lyon' },
        { id: 'c3', text: 'Nice' }
      ],
      correct: ['c1']
    },
    {
      id: 'qq2',
      type: 'multi',
      prompt: 'Which of these are European Union members?',
      choices: [
        { id: 'c1', text: 'Germany' },
        { id: 'c2', text: 'Norway' },
        { id: 'c3', text: 'Spain' },
        { id: 'c4', text: 'Switzerland' }
      ],
      correct: ['c1', 'c3']
    },
    {
      id: 'qq3',
      type: 'single',
      prompt: 'Which city is the capital of Italy?',
      choices: [
        { id: 'c1', text: 'Milan' },
        { id: 'c2', text: 'Rome' },
        { id: 'c3', text: 'Venice' }
      ],
      correct: ['c2']
    }
  ]
};
