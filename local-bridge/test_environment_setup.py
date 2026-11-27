"""Isolated temporary-copy tests; no real secret or database files are used."""
import base64
import subprocess
import sys
import tempfile
import unittest
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parent
class EnvironmentSetupTests(unittest.TestCase):
    def test_separate_setup_and_no_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);shutil.copyfile(ROOT/"setup.py",root/"setup.py")
            def setup(env):
                return subprocess.run([sys.executable,str(root/"setup.py"),"--environment",env],input="\n",text=True,capture_output=True)
            for env in ("sandbox","production"):
                out=setup(env);self.assertEqual(out.returncode,0,out.stderr)
                secret=root/".secrets"/env
                agent=(secret/"hermes.env").read_text().strip().split("=",1)[1]
                bridge=(secret/"bridge.env").read_text().strip().split("=",1)[1]
                self.assertTrue(agent.startswith("cp_"+env+"_agent_"))
                self.assertTrue(bridge.startswith("cp_"+env+"_bridge_"))
                self.assertNotIn(agent,out.stdout)
                before=(secret/"hermes.env").read_bytes()
                self.assertNotEqual(setup(env).returncode,0)
                self.assertEqual((secret/"hermes.env").read_bytes(),before)
            self.assertNotEqual((root/".secrets/sandbox/vercel.env").read_text(),(root/".secrets/production/vercel.env").read_text())
    def test_run_rejects_wrong_bridge_before_bind(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);shutil.copyfile(ROOT/"run.py",root/"run.py")
            (root/"bridge.py").write_text("class Store:\n def __init__(self,*args): raise AssertionError('must not open database')\ndef serve(*args): raise AssertionError('must not bind')\n")
            d=root/".secrets/sandbox";d.mkdir(parents=True)
            (d/"bridge.env").write_text("CREATORPULSE_BRIDGE_TOKEN=cp_production_bridge_"+"x"*40+"\n")
            out=subprocess.run([sys.executable,str(root/"run.py"),"--environment","sandbox"],text=True,capture_output=True)
            self.assertNotEqual(out.returncode,0)
            self.assertIn("wrong-environment",out.stderr)
            self.assertFalse((root/"data").exists())
if __name__=="__main__": unittest.main()
