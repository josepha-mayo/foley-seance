# Actual waveform overview and descriptive filenames

Integrator-only UI improvement; shared Kiro DSP remains unchanged. View helper reads the exact native-decoded export without mutating samples;64peak bins perchannel share a display scale. Explicit text distinguishes visibility scaling from loudness and source/tail divider from silence. Paths clear on invalidation; responsive rules retain the figure. Filename helper sanitizes source text and adds route/door/rate, without claiming uniqueness.

Independent source review GO and67tests pass. Native Chrome rendered the accessible overview, exposed the configured descriptive download name, downloaded the cue and cleared the waveform after an edit. Independent file readback was byte-identical to the prior actual browser export. No human listening or phone acceptance claim.
