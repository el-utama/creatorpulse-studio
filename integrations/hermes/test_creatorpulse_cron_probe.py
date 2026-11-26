import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import creatorpulse_cron_probe as probe


class CronProbeTests(unittest.TestCase):
    def test_profile_context_requires_explicit_matching_home_and_script(self):
        with tempfile.TemporaryDirectory() as root:
            home = Path(root)/"hermes"/"profiles"/"creatorpulse-sandbox"
            script = home/"scripts"/"creatorpulse_cron_probe.py"
            env = {"LOCALAPPDATA":root, "HERMES_HOME":str(home)}
            self.assertEqual(probe.profile_context(script,env),home.resolve())
            for bad in ({}, {**env,"HERMES_HOME":str(home.parent.parent)}):
                with self.assertRaises(ValueError):
                    probe.profile_context(script,bad)
            with self.assertRaises(ValueError):
                probe.profile_context(home.parent.parent/"scripts"/script.name,env)

    def test_collect_uses_only_read_operations_and_reports_aggregates(self):
        slot = "a"*32
        replies = [
            {"accounts":[{"id":slot,"name":"Utama"}]},
            {"user":{"follower_count":0,"following_count":2,"likes_count":0,"video_count":0}},
            {"videos":[],"has_more":False},
            {"region":"ID","days":7,"provenance":"agent_submitted_unverified","observations":[{"id":"fixture"}]},
        ]
        with patch.object(probe,"read_tool",side_effect=replies) as read:
            result = probe.collect(["adapter"])
        self.assertEqual([c.args[1] for c in read.call_args_list],
                         ["list_accounts","get_analytics","list_videos","list_trends"])
        self.assertEqual(result["accounts"][0]["metrics"]["following_count"],2)
        self.assertEqual(result["trend_observations"],1)
        self.assertEqual(result["publication_calls"],0)
        self.assertEqual(result["trend_writes"],0)
        self.assertNotIn(slot,str(result))
        self.assertNotIn("fixture",str(result))

    def test_write_guard_and_incomplete_response(self):
        with patch.object(probe.subprocess,"run") as run:
            with self.assertRaises(ValueError):
                probe.read_tool(["adapter"],"record_trend",{})
            run.assert_not_called()
        with patch.object(probe,"read_tool",return_value={"accounts":[]}):
            with self.assertRaises(ValueError):
                probe.collect(["adapter"])


if __name__ == "__main__":
    unittest.main()
