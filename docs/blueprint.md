# **App Name**: Examplify AI

## Core Features:

- Exam Syllabus Decomposition: Use Gemini API to parse an exam syllabus PDF into a structured list of topics. Utilizes AI as a tool to decide how to best compartmentalize the topics.
- Topic Selection UI: A clean and intuitive user interface for browsing and selecting exam topics.
- Past Paper Upload & Management: Allows users to upload a set of past exam papers and manage the uploaded papers.
- Granular Subsection Generation: Generates a granular list of subsections for each topic, using Gemini to understand the scope of the topic. Utilizes AI as a tool to decide how to divide the topics into subsections.
- Subsection Score Preview: Provides users with a preview of their overall score (out of 100) for each subsection, starting at 0. Each question should increase the user's score in this topic.
- AI-Powered Interview-Style Question Generation: Generates exam-style questions for each subsection based on uploaded past papers, using RAG to improve performance, and a chat-style conversational system that provides incremental guidance towards the correct answer. Utilizes AI as a tool to decide what guidance is more appropriate to incorporate.
- Score Calculation & Update: Calculates a score out of 10 based on the correctness of the user's answer in the AI-powered interview and updates the overall subsection score.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to convey trust, stability, and knowledge, reflecting the educational context of the app. It symbolizes focus and intelligence, promoting a sense of calm and concentration for learning.
- Background color: Light blue (#E3F2FD), very desaturated to avoid distraction.
- Accent color: Violet (#9575CD), significantly different in brightness and saturation, adding depth to the interface.
- Body and headline font: 'PT Sans', a humanist sans-serif with a modern, readable style suitable for both headings and body text.
- Code font: 'Source Code Pro' for displaying code snippets.
- Use clear, academic-themed icons.
- Use subtle transitions between topics.