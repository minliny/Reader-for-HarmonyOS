# R7 independent source preservation plan

Purpose: preserve the upcoming stable manga viewport repair independently. Root owns issue recording and production changes; the test agent owns test changes. This agent does not edit production code or tests, build, use HDC or rewrite earlier evidence.

The parent chain is the exact R4 full source archive, R5 two-file delta and R6 twelve-file delta. R6 reconstructed source has 7,113 files, including the two canonical R5 negative-control fixtures. R6 source delta SHA-256 is `bcaad688874908ffb83bfb9d0de8a21497c1dce55f56887b4721a7c843132a55`; effective source fingerprint is `c71936aced3644d4ea9fc8c0bb7610bc72467dcd7b3f3a4362b6892bbca49e4b`. R6 final evidence inventory SHA-256 is `4d273722ddaea9f4ce9edda74e060fbaccb0baa9e778c57a339fd671ac45630d`. All R6 records remain frozen.

1. Wait for Root's final R7 allowlist and exact hashes for frozen production and test inputs. Do not copy source files while the repair or test adaptation is still active.
2. Verify persistent files still match the R6 parent before writing. Copy only explicitly frozen R7 replacements or additions, preserving byte content and file mode. Report any unrelated drift before mutation.
3. Compare the complete R6 effective inventory with the independent delivery workspace, rejecting modifications or source additions outside the final allowlist. Confirm controlled workspace source membership, Core input fingerprint and exact Native SDK package remain unchanged.
4. Create a new R7 delta with explicit replace/add operations. Apply R4 + R5 + R6 + R7 in a new temporary reconstruction directory and read back every source file's path, type, mode, length and SHA-256. Verify the candidate did not change during preservation and the parent archives remain untouched.
5. After Root publishes the new canonical manifest, save exact public records in the new R7 canonical-binding directory. Match all canonical source, controller and workspace inputs to the reconstructed inventory; read back the actual HAP and embedded Native bytes. Do not copy private signing configuration or claim device/visual acceptance from package binding.
6. Preserve failure attempts and successful later evidence separately. Final evidence closure occurs only after Root confirms VM records and independent review are frozen; it does not modify R4, R5 or R6.

No immediate full-parent copy, build, package, install, VM operation or source synchronization is performed by this plan. The source candidate remains `/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913`; the persistent manga worktree remains `/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002`.
