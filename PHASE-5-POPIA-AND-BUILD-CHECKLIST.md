# Richfield Connect — Phase 5 Production Verification & POPIA Sign-off Checklist

## Scope
This checklist is the release gate for the final Phase 5 build. It is an engineering and compliance readiness checklist, not a legal opinion or a declaration by the Information Regulator that the application is compliant.

## Android release verification

- [ ] `npm ci` completes from a clean checkout.
- [ ] `npm run typecheck` completes with zero errors.
- [ ] `cd functions && npm ci && npm run build` completes with zero errors.
- [ ] Firebase project ID, Android package name, SHA-1/SHA-256 fingerprints and `google-services.json` match the production Firebase project.
- [ ] App Check is enforced in production and debug providers are not enabled in the release build.
- [ ] Email-link authentication deep links open the production application and complete successfully on a physical Android device.
- [ ] Student domain registration is rejected server-side for non-approved domains.
- [ ] Alumni verification returns a generic failure response for unmatched records and does not reveal registry membership.
- [ ] Business accounts remain blocked until administrator approval.
- [ ] Suspend/revoke immediately disables the Firebase Auth account and removes platform access after token refresh.
- [ ] Administrator accounts cannot be self-registered and administrator management cannot target another administrator through the mobile panel.
- [ ] Firestore Rules emulator tests cover every collection and all allow/deny boundaries.
- [ ] Storage Rules reject raw video downloads and unauthorized uploads.
- [ ] FCM foreground/background notification delivery is tested on physical Android hardware.
- [ ] Transcoder output is H.264/AAC at the configured 720p profile and a thumbnail is generated.
- [ ] Transcoder input uses the complete Storage object name: `gs://${bucket}/${name}`.
- [ ] Release APK/AAB is signed with the production signing key and verified from a clean install.

## iOS release verification

- [ ] `pod install` completes from a clean checkout.
- [ ] `npm run typecheck` completes with zero errors.
- [ ] Firebase iOS configuration matches the production bundle identifier.
- [ ] APNs key/certificate is configured for the production Firebase project.
- [ ] App Check is enforced for the production iOS bundle.
- [ ] Universal/deep-link handling completes the alumni email-link flow on a physical iPhone.
- [ ] FCM foreground/background delivery is tested on physical iOS hardware.
- [ ] Production archive succeeds in Xcode with no signing warnings.
- [ ] Release archive is exported using the correct distribution profile and verified by installing through the intended distribution channel.
- [ ] Suspend/revoke, moderation, broadcast and role routing are verified on iOS.

## Backend release verification

- [ ] `firebase deploy --only firestore:rules,firestore:indexes,functions,storage` succeeds against the intended production project.
- [ ] Production Functions are deployed in the configured region and have least-privilege service configuration.
- [ ] `AI_API_KEY` and all other secrets are stored in the Functions secret manager; no secret is bundled into React Native.
- [ ] Administrator provisioning is performed only through the Admin SDK provisioning process.
- [ ] `admin_logs` records user lifecycle, moderation and broadcast actions with administrator UID, action, target and timestamp.
- [ ] Firestore indexes deploy successfully.
- [ ] Rate limiting and App Check are enabled for all privileged callable functions.
- [ ] Logs do not contain national IDs, passwords, authentication tokens, FCM registration tokens, CV contents or unnecessary personal information.

## POPIA engineering readiness

### Governance
- [ ] Richfield identifies the responsible party and formally assigns/registers the Information Officer as required.
- [ ] A documented processing inventory exists for student, alumni, business and administrator data.
- [ ] A documented retention/deletion schedule exists for profiles, CVs, messages, moderation records, analytics and security logs.
- [ ] Operator/data-processing agreements are in place for Firebase/Google Cloud and any AI provider used for CV/profile processing.
- [ ] Cross-border processing and international data transfers have been assessed and approved where required.
- [ ] A privacy notice explains purposes, categories of information, recipients/operators, retention, rights and complaint channels.
- [ ] Data-subject access, correction, deletion/restriction and objection workflows are documented and operational.

### Security safeguards
- [ ] Least-privilege Firebase IAM is applied.
- [ ] Firestore and Storage deny-by-default rules are deployed.
- [ ] Authentication is enforced for protected data and privileged Functions use App Check.
- [ ] Administrator actions are auditable.
- [ ] Sensitive verification data is not exposed through client-readable collections.
- [ ] Security monitoring and incident response procedures are documented.
- [ ] Backups, exports and logs are protected with appropriate access controls.

### Security compromise response
- [ ] A breach-response runbook names the Information Officer/Deputy Information Officer and technical incident owner.
- [ ] The team can identify affected data subjects and the categories of personal information involved.
- [ ] The organisation can notify the Information Regulator and affected data subjects as required by POPIA section 22.
- [ ] The Information Regulator eServices security-compromise reporting path has been tested or documented.

## POPIA sign-off status

**Engineering status:** READY FOR FORMAL COMPLIANCE REVIEW only after every unchecked item above is evidenced.

**Legal/regulatory status:** NOT SELF-CERTIFIED. Final POPIA sign-off must be issued by Richfield's authorised Information Officer/legal/compliance function. This checklist does not constitute a legal opinion or approval by the Information Regulator.

## Evidence pack

Retain the following with the release record:

1. Firestore Rules emulator test report.
2. Storage Rules test report.
3. Android release build hash and test matrix.
4. iOS release archive/test matrix.
5. Firebase Functions deployment output.
6. Admin provisioning audit record.
7. Penetration/security test report.
8. Privacy impact/risk assessment and processing inventory.
9. Operator agreements and cross-border transfer assessment.
10. POPIA privacy notice and data-subject rights procedure.
11. Security incident response and section 22 notification procedure.
