# R6 public canonical binding

After the parent publishes an R6 canonical HAP manifest, `bind_canonical.py --manifest ABSOLUTE_MANIFEST_PATH --expected-signed-sha256 CONFIRMED_HASH` reads back the actual artifacts, embedded Native bytes and all canonical source/controller/workspace input records. It requires both R5 counterfactual fixtures to be present in the canonical controller snapshot. The helper appends exact public records and does not build, install or copy private signing materials.

`python3 verify_binding.py --require-artifacts` independently verifies the preserved public records and actual HAP bytes without the original temporary source tree. The R4 full archive, R5 delta and R6 delta remain immutable. A binding proves the source-to-package chain; it does not prove device behavior, animation timing or user acceptance. This remains an iteration build with `acceptanceEligible=false`.
