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
    def test_trend_region_and_filter_validation(self):
        with patch.object(proxy,"request",return_value={}) as request:
            for region in ("Indonesia","ID","id"," indonesia "):
                proxy.call("list_trends",{"region":region,"days":7},"fixture")
                request.assert_called_with("/trends?region=ID&days=7","fixture")
            request.reset_mock()
            for args in ({"region":"invalid"},{"days":"7"},{"days":True},{"days":0},{"days":91}):
                with self.assertRaises(ValueError):
                    proxy.call("list_trends",args,"fixture")
            request.assert_not_called()
            observation=dict(topic="fixture",type="topic",region="Indonesia",source="web_research",sourceUrl="https://example.com",observedAt="2026-11-26",evidence="fixture")
            proxy.call("record_trend",observation,"fixture")
            request.assert_called_once_with("/trends","fixture",{**observation,"region":"ID"},"POST")
            self.assertEqual(observation["region"],"Indonesia")

    def test_trend_http_error_allowlist(self):
        import io
        from urllib.error import HTTPError
        key="cp_sandbox_agent_"+"a"*40
        with patch.object(proxy,"ENVIRONMENT","sandbox"),patch.object(proxy,"BYPASS_FILE",None),patch.object(proxy.urllib.request,"build_opener") as opener:
            def reject(body):
                opener.return_value.open.side_effect=HTTPError("https://example.com",400,"bad",{},io.BytesIO(json.dumps(body).encode()))
            reject({"error":"Filter tren tidak valid."})
            with self.assertRaisesRegex(ValueError,"Invalid region or days"):
                proxy.request("/trends?region=ID",key)
            reject({"error":"SECRET FIXTURE"})
            with self.assertRaisesRegex(ValueError,"Check configuration"):
                proxy.request("/trends",key)
            reject({"error":"Filter tren tidak valid."})
            with self.assertRaisesRegex(ValueError,"Check configuration"):
                proxy.request("/accounts",key)

    def test_local_video_draft_and_approved_upload(self):
        import hashlib
        data=b"0000ftypisomfixture"
        with tempfile.TemporaryDirectory() as tmp, patch.object(proxy,"ENVIRONMENT","sandbox"):
            path=Path(tmp).resolve()/"test_upload.mp4";path.write_bytes(data)
            args={"requestId":"f354ac33-a736-4e34-9bad-ac9e37c2005a","accountId":"a"*32,"filePath":str(path),"caption":"Cafe","mode":"inbox"}
            media={"name":path.name,"size":len(data),"sha256":hashlib.sha256(data).hexdigest()}
            with patch.object(proxy,"request",return_value={}) as request:
                proxy.call("prepare_local_post",args,"fixture")
                request.assert_called_once_with("/posts","fixture",{**{k:v for k,v in args.items() if k!="filePath"},"localMedia":media},"POST")
            post=args["requestId"];execute={"postId":post,"filePath":str(path)}
            with patch.object(proxy,"request",return_value={"state":"draft","localMedia":media}) as request:
                with self.assertRaises(ValueError):
                    proxy.call("execute_local_post",execute,"fixture")
                request.assert_called_once_with("/posts/"+post,"fixture")
            with patch.object(proxy,"request",side_effect=[{"state":"approved","localMedia":media},{"state":"submitted"}]) as request:
                self.assertEqual(proxy.call("execute_local_post",execute,"fixture"),{"state":"submitted"})
                request.assert_called_with("/posts/"+post+"/execute-file","fixture",data,"POST")
            path.write_bytes(data[:-1]+b"X")
            with patch.object(proxy,"request",return_value={"state":"approved","localMedia":media}) as request:
                with self.assertRaises(ValueError):
                    proxy.call("execute_local_post",execute,"fixture")
                request.assert_called_once_with("/posts/"+post,"fixture")
            with patch.object(proxy,"ENVIRONMENT","production"):
                with self.assertRaises(ValueError):
                    proxy.local_video(str(path))

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
    def test_managed_skill_refresh_preserves_working_profile(self):
        with tempfile.TemporaryDirectory() as tmp:
            home=Path(tmp)/"profiles"/"creatorpulse-sandbox";home.mkdir(parents=True)
            config=home/"config.yaml";config.write_bytes(b"model: unchanged\n")
            env=home/".env";env.write_bytes(b"OTHER_KEY=unchanged\n")
            skill=home/"skills"/"creatorpulse"/"SKILL.md";skill.parent.mkdir(parents=True)
            skill.write_text("---\nname: creatorpulse\n---\n# CreatorPulse content operations — sandbox\nOld managed skill\n",encoding="utf-8")
            self.assertEqual(bootstrap.sync_managed_skill(home,environment="sandbox"),"updated")
            rendered=skill.read_text(encoding="utf-8")
            self.assertIn("required evidence sequence",rendered)
            self.assertIn("list_accounts",rendered)
            self.assertIn("observation.id",rendered)
            self.assertIn("list_trends again",rendered)
            self.assertNotIn("{{ENVIRONMENT}}",rendered)
            with patch.object(bootstrap,"atomic_write",side_effect=AssertionError("No write on repeat")):
                self.assertEqual(bootstrap.sync_managed_skill(home,environment="sandbox"),"current")
            self.assertEqual(config.read_bytes(),b"model: unchanged\n")
            self.assertEqual(env.read_bytes(),b"OTHER_KEY=unchanged\n")
            self.assertFalse((home/"integrations").exists())
            skill.write_text("Unrelated user skill",encoding="utf-8")
            with self.assertRaises(ValueError):
                bootstrap.sync_managed_skill(home,environment="sandbox")
            self.assertEqual(skill.read_text(encoding="utf-8"),"Unrelated user skill")
            with self.assertRaises(ValueError):
                bootstrap.sync_managed_skill(home,environment="production")

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
