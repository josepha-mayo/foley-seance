# Proof-one integration scope

Central engine: genuine Kiro generation, with corrections enumerated in PROVENANCE.md. UI/controller authored separately. Raw generation is preserved unchanged.

Further integration: precise native Chrome PCM arithmetic. Positive signed PCM16 values are decoded by tested Chrome as float32(integer * float32(1/32767)); negatives use /32768. First symmetric scaling attempt failed actual browser at 12,806 samples; ordinary positive division then differed by one ULP at 406 samples. Matching observed reciprocal arithmetic produced zero differences without tolerance. This is a tested Chrome convention, not a universal decoder claim. Other browsers can differ and currently fail closed rather than offer an unverified preview. Playback uses the actual browser-decoded export bytes.

49 unit/integration tests pass, including independent signed-PCM inspection, deterministic repeated render, finite bounded output, controls affecting sound, and exact preview mapping. Actual cloud Chrome tap, creak and closed-door breath rendered with zero sample differences. Tap playback invoked and browser download read back independently as stereo PCM16, 24 kHz, 43,200 frames, identical file SHA to UI receipt. No clipping. Runtime/audio/test evidence intentionally excluded from repository.

Limitations: no human listening-quality approval; no independent-player proof (direct WAV navigation blocked by client and not retried); no Windows browser or imported-recording acceptance; no mobile geometry acceptance. Authored trajectory, not live performance. Synthetic demo sources are not recordings. No project persistence. No publication.
