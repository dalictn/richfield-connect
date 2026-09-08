# Richfield Connect

A production-grade, cross-platform mobile platform unifying Students, Alumni, Business Recruiters, and Administrators into a single trusted institutional network for the Richfield and AAA community.

## System Architecture & Technology Choices
- **Frontend**: React Native (with React Native Web for cross-platform execution)
- **Backend & Identity**: Firebase Authentication with custom claims & blocking functions
- **Database**: Cloud Firestore with granular, field-level POPIA visibility controls
- **Asynchronous Media**: Google Cloud Transcoder for 720p H.264 video compression & thumbnail generation
- **AI & NLP**: Google Gemini 1.5 Flash for contextual profile coaching and automated CV skills parsing

## Role-Based Access Control (RBAC)
- **Student**: Strict institutional domain validation (@richfield.ac.za, @aaa.ac.za).
- **Alumni**: Zero-leakage identity verification against the pre-seeded alumni registry using cryptographic hashing.
- **Business**: Dual-phase onboarding requiring formal administrative review before platform activation.
- **Administrator**: Dedicated moderation console for user governance and institutional broadcasts.

## Team Members & Responsibilities (Group 6)
- **Mosalasaa999**: Project Scaffolding, Core Authentication & Firebase Architecture
- **dalictn (Dali)**: System Architecture, AI Profile Assistant & Administrative Suite
- **gloriouslindelani-oss (Lindelani)**: 20-Field Portfolio Engine & POPIA Visibility Controls
- **Zenacy (Nxilimbelenthlanu)**: Social Graph, Real-Time Messaging & Cloud Media Pipelines

## Compliance & Security
Built in compliance with the South African **Protection of Personal Information Act (POPIA)** featuring user-controlled field visibility (Public, Connections, Private).
