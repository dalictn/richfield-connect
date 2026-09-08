# Richfield Connect

A production-grade, cross-platform mobile platform unifying Students, Alumni, Business Recruiters, and Administrators into a single trusted institutional network for the Richfield and AAA community.

## System Architecture & Technology Choices
- **Frontend Framework**: React Native (with React Native Web for cross-platform interoperability)
- **Backend & Identity**: Firebase Authentication with server-side custom claims and blocking functions
- **Database**: Cloud Firestore with granular, field-level POPIA visibility controls
- **Asynchronous Processing**: Google Cloud Transcoder for 720p H.264 video compression & thumbnail generation
- **AI & NLP**: Google Gemini 1.5 Flash for contextual profile coaching and automated CV skills parsing

## Role-Based Access Control (RBAC)
- **Student**: Institutional email verification restricted strictly to approved domains (@richfield.ac.za, @aaa.ac.za).
- **Alumni**: Zero-leakage verification against the pre-seeded alumni registry using cryptographic hashing.
- **Business**: Dual-phase onboarding requiring formal administrative review before platform access.
- **Administrator**: Privileged moderation console for content governance and broadcast announcements.

## Getting Started
\\\ash
# Install dependencies
npm install

# Run Web Development Server
npm run web

# Start Android Native Build
npm run android
\\\

## Compliance & Security
Built in compliance with the South African **Protection of Personal Information Act (POPIA)** featuring user-controlled field visibility (Public, Connections, Private).
