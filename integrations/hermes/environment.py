"""Fixed environment allowlist. No arbitrary gateway URL or default production."""
HOSTS={"sandbox":"https://creatorpulse-studio-git-sandbox-total-management1.vercel.app","production":"https://creatorpulse-studio-six.vercel.app"}
PROFILES={"sandbox":"creatorpulse-sandbox","production":"creatorpulse"}
def key_prefix(environment,role="agent"):
    return "cp_"+environment+"_"+role+"_"
