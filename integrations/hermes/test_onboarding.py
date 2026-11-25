import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import bootstrap
import proxy

class OnboardingTests(unittest.TestCase):
    def test_local_discovery_no_network(self):
        with patch.object(proxy,"request",side_effect=AssertionError("Network")):
            for method in ("initialize","tools/list","ping"):
                out=proxy.rpc({"jsonrpc":"2.0","id":1,"method":method,"params":{}},lambda:None)
                self.assertIn("result",out)
            self.assertNotIn("approve_post",proxy.BY_NAME)
    def test_tool_routes_and_no_approval(self):
        with patch.object(proxy,"request",return_value={"accounts":[]}) as mock:
            proxy.call("list_accounts",{},"test")
            mock.assert_called_once_with("/accounts","test")
        for name,args in [("approve_post",{}),("get_analytics",{"accountId":"../accounts"}),("list_accounts",{"foo":1})]:
            with self.assertRaises(ValueError):
                proxy.call(name,args,"test")
    def test_install_preserves_model_and_chat(self):
        import yaml
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp)/"profiles"/"creatorpulse-sandbox";home.mkdir(parents=True)
            config={"model":{"model":"nemotron-super-120b-vl","provider":"nvidia"},"platforms":{"telegram":{"enabled":True},"whatsapp":{"enabled":True}},"mcp_servers":{"other":{"command":"example"}}}
            (home/"config.yaml").write_text(yaml.safe_dump(config))
            (home/".env").write_text("OTHER_KEY=preserved\n")
            before=(home/"config.yaml").read_text()
            plan=bootstrap.install(home,environment="sandbox")
            self.assertEqual(plan["mode"],"plan")
            self.assertEqual((home/"config.yaml").read_text(),before)
            env=home/"agent.env";env.write_text("CREATORPULSE_AGENT_KEY=cp_sandbox_agent_"+"a"*40+"\n")
            with patch.object(bootstrap.subprocess,"run",return_value=type("P",(),{"stdout":'{"gateway":"connected","accounts":1}'})()):
                out=bootstrap.install(home,True,env,environment="sandbox")
            self.assertEqual(out["connection"]["accounts"],1)
            after=yaml.safe_load((home/"config.yaml").read_text())
            self.assertEqual(after["model"],config["model"])
            self.assertEqual(after["platforms"],config["platforms"])
            self.assertEqual(after["mcp_servers"]["other"],config["mcp_servers"]["other"])
            self.assertTrue((home/"skills/creatorpulse/SKILL.md").is_file())
            self.assertIn("OTHER_KEY=preserved",(home/".env").read_text())
            self.assertNotIn("a"*40,(home/"config.yaml").read_text())
            self.assertNotIn("a"*40,json.dumps(out))
            self.assertTrue(Path(out["backup"],"config.yaml").is_file())
    def test_existing_key_conflict(self):
        import yaml
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp)/"profiles"/"creatorpulse-sandbox";home.mkdir(parents=True);(home/"config.yaml").write_text("model: existing\n")
            (home/".env").write_text("CREATORPULSE_AGENT_KEY=cp_sandbox_agent_"+"a"*40+"\n")
            env=home/"agent.env";env.write_text("CREATORPULSE_AGENT_KEY=cp_sandbox_agent_"+"b"*40+"\n")
            with self.assertRaises(ValueError): bootstrap.install(home,True,env,environment="sandbox")
            self.assertEqual((home/"config.yaml").read_text(),"model: existing\n")
    def test_wrong_profile_and_key_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            with self.assertRaises(ValueError): bootstrap.profile_home(root,"sandbox")
            home=root/"profiles"/"creatorpulse-sandbox";home.mkdir(parents=True)
            (home/"config.yaml").write_text("model: existing\n")
            source=home/"agent.env";source.write_text("CREATORPULSE_AGENT_KEY=cp_production_agent_"+"p"*40+"\n")
            with self.assertRaises(ValueError): bootstrap.install(home,True,source,environment="sandbox")
            self.assertFalse((home/"integrations").exists())
            with self.assertRaises(ValueError): proxy.key_from_env(source,"sandbox")
            source.write_text("CREATORPULSE_AGENT_KEY=cp_sandbox_agent_"+"s"*40+"\n")
            with patch.dict(os.environ,{"CREATORPULSE_AGENT_KEY":"cp_production_agent_"+"p"*40}):
                self.assertEqual(proxy.key_from_env(source,"sandbox"),"cp_sandbox_agent_"+"s"*40)
            with patch.object(proxy,"ENVIRONMENT","sandbox"),patch.object(proxy.urllib.request,"build_opener") as opener:
                with self.assertRaises(ValueError): proxy.request("/accounts","cp_production_agent_"+"p"*40)
                opener.assert_not_called()
            with patch.object(proxy,"ENVIRONMENT","sandbox"),patch.object(proxy.urllib.request,"build_opener") as opener:
                opener.return_value.open.side_effect=ValueError("stop")
                with self.assertRaises(ValueError): proxy.request("/accounts","cp_sandbox_agent_"+"s"*40)
                req=opener.return_value.open.call_args.args[0]
                self.assertEqual(req.full_url,"https://creatorpulse-studio-git-sandbox-total-management1.vercel.app/api/gateway/v1/accounts")
                self.assertEqual(req.get_header("X-creatorpulse-environment"),"sandbox")
    def test_preview_bypass_only_sandbox(self):
        with tempfile.TemporaryDirectory() as tmp:
            secret=Path(tmp)/"bypass";secret.write_text("x"*32)
            with patch.object(proxy,"BYPASS_FILE",str(secret)),patch.object(proxy,"ENVIRONMENT","production"),patch.object(proxy.urllib.request,"build_opener") as opener:
                with self.assertRaises(ValueError): proxy.request("/health")
                opener.assert_not_called()
            with patch.object(proxy,"BYPASS_FILE",str(secret)),patch.object(proxy,"ENVIRONMENT","sandbox"),patch.object(proxy.urllib.request,"build_opener") as opener:
                opener.return_value.open.side_effect=ValueError("stop")
                with self.assertRaises(ValueError): proxy.request("/health")
                req=opener.return_value.open.call_args.args[0]
                self.assertEqual(req.get_header("X-vercel-protection-bypass"),"x"*32)
if __name__=="__main__": unittest.main()
