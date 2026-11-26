import unittest
from windows_resume import next_gate, account_id, rpc_batch, audit_legacy, legacy_clear
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

class Gates(unittest.TestCase):
    def setUp(self):
        self.pre = dict(host="PC09-PR",identity="PC09-PR\\USER",elevated=False,service_account="enabled",listener={"LocalAddress":"127.0.0.1","LocalPort":8766})
        self.receipt = dict(schema=1,owner_isolation_reviewed=True,bypass_approved=True)
        self.gateway = dict(gateway="connected",environment="sandbox",accounts=1)
    def test_legacy_probes(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            self.assertTrue(legacy_clear(audit_legacy(root)))
            secret = root/"local-bridge"/".secrets"/"sandbox"
            secret.mkdir(parents=True)
            (secret/"vercel.env").write_text("fixture only")
            probes = audit_legacy(root)
            self.assertEqual(probes["local-bridge/.secrets/sandbox/vercel.env"],"accessible")
            self.assertFalse(legacy_clear(probes))
        self.assertTrue(legacy_clear({"one":"denied","two":"absent"}))
        self.assertFalse(legacy_clear({"one":"unknown"}))
        self.assertFalse(legacy_clear({}))
    def test_order(self):
        self.assertEqual(next_gate(self.pre,None),"OWNER_PROVISION")
        self.assertEqual(next_gate(self.pre,self.receipt),"CHECK_GATEWAY")
        self.assertEqual(next_gate(self.pre,self.receipt,{**self.gateway,"accounts":0}),"OWNER_ENROLL")
        self.assertEqual(next_gate(self.pre,self.receipt,self.gateway),"ACTIVATE_MCP")
    def test_fail_closed(self):
        for changed in ({"elevated":True},{"identity":"PC09-PR\\CreatorPulseBridge"},{"host":"OTHER"}):
            self.assertEqual(next_gate({**self.pre,**changed},self.receipt,self.gateway),"WRONG_HOST_OR_IDENTITY")
        self.assertEqual(next_gate({**self.pre,"listener":"not_found_or_hidden"},self.receipt,self.gateway),"BRIDGE_LISTENER_UNVERIFIED")
        self.assertEqual(next_gate(self.pre,{},self.gateway),"OWNER_RECEIPT_INVALID")
        self.assertEqual(next_gate(self.pre,self.receipt,{**self.gateway,"environment":"production"}),"GATEWAY_BLOCKED")
        self.assertEqual(next_gate(self.pre,self.receipt,{**self.gateway,"accounts":4}),"GATEWAY_RESPONSE_INVALID")
        self.assertEqual(next_gate(self.pre,{**self.receipt,"bypass_approved":False},{"gateway":"blocked"}),"PREVIEW_ACCESS_OR_GATEWAY_BLOCKED")
    def test_readonly_guard(self):
        with self.assertRaises(ValueError):
            rpc_batch(["never-run"],[("execute_approved_post",{})])
    def test_account_schema(self):
        slot="a"*32
        self.assertEqual(account_id({"accounts":[{"accountId":slot}]}),(slot,1))
        with self.assertRaises(ValueError):
            account_id({"accounts":[{"id":slot,"accountId":"b"*32}]})
        with self.assertRaises(ValueError):
            account_id({"accounts":[]})

class RuntimeTests(unittest.TestCase):
    def test_prefer_machine_git_and_reject_windowsapps_alias(self):
        from windows_resume import git_executable
        with patch("windows_resume.Path.is_file", return_value=True), patch("windows_resume.shutil.which") as which:
            self.assertEqual(git_executable(),r"C:\Program Files\Git\cmd\git.exe")
            which.assert_not_called()
        # Use slash separators for a portable fixture; actual Windows Path uses native separators.
        with patch("windows_resume.Path.is_file", return_value=False), patch("windows_resume.shutil.which",return_value="C:/Program Files/WindowsApps/package/git.exe"):
            self.assertIsNone(git_executable())
        with patch("windows_resume.Path.is_file", return_value=False), patch("windows_resume.shutil.which",return_value="C:/Tools/Git/bin/git.exe"):
            self.assertEqual(git_executable(),"C:/Tools/Git/bin/git.exe")

    def test_checkout_uses_explicit_git_and_requires_clean_matching_branch(self):
        from windows_resume import checked_git
        from types import SimpleNamespace
        git="fixture-git"
        with patch("windows_resume.run") as run:
            run.side_effect=[SimpleNamespace(returncode=0,stdout=x) for x in ("sandbox","","a"*40,"a"*40)]
            self.assertEqual(checked_git(git),"a"*40)
            self.assertEqual(run.call_count,4)
            self.assertTrue(all(c.args[0][0]==git for c in run.call_args_list))
            run.side_effect=[SimpleNamespace(returncode=0,stdout=x) for x in ("sandbox"," M changed","a"*40,"a"*40)]
            self.assertIsNone(checked_git(git))

    def test_reuse_existing_isolated_yaml_without_path_mutation(self):
        import sys
        from types import SimpleNamespace
        from unittest.mock import Mock
        from windows_resume import controller_yaml
        with TemporaryDirectory() as directory, patch.dict("os.environ",{"LOCALAPPDATA":directory}):
            lib=Path(directory)/"hermes"/"cache"/"scratch"/"pyyaml-lib"
            before=list(sys.path)
            loader=Mock(side_effect=ValueError("missing"))
            self.assertIsNone(controller_yaml(SimpleNamespace(load_yaml=loader)))
            self.assertEqual(loader.call_count,1)
            (lib/"yaml").mkdir(parents=True)
            (lib/"yaml"/"__init__.py").touch()
            sentinel=object()
            def load():
                if str(lib) not in sys.path:
                    raise ValueError("missing")
                return sentinel
            self.assertIs(controller_yaml(SimpleNamespace(load_yaml=load)),sentinel)
            self.assertEqual(sys.path,before)
            self.assertIsNone(controller_yaml(SimpleNamespace(load_yaml=Mock(side_effect=ValueError("missing")))))
            self.assertEqual(sys.path,before)


class ValidationReportTests(unittest.TestCase):
    def test_reports_only_after_cli_passes(self):
        from windows_resume import finish_validation
        from types import SimpleNamespace
        with patch("windows_resume.validate_adapter",return_value=1), patch("windows_resume.shutil.which",return_value="hermes"), patch("windows_resume.run") as run, patch("windows_resume.report_validation",return_value={"state":"reported"}) as report:
            run.side_effect=[SimpleNamespace(returncode=0,stdout="test"),SimpleNamespace(returncode=1)]
            self.assertEqual(finish_validation([], "a"*40, "fixture", None)["state"],"HERMES_CLI_TEST_FAILED")
            report.assert_not_called()
            run.side_effect=[SimpleNamespace(returncode=0,stdout="test"),SimpleNamespace(returncode=0)]
            out=finish_validation([], "a"*40, "fixture", None)
            self.assertEqual(out["state"],"READONLY_VALIDATED")
            self.assertEqual(out["dashboard_validation"],{"state":"reported"})
            report.assert_called_once_with("a"*40,1,"fixture",None)
            report.reset_mock()
            run.side_effect=[SimpleNamespace(returncode=0,stdout="test"),SimpleNamespace(returncode=0)]
            report.return_value={"state":"unverified"}
            out=finish_validation([], "a"*40, "fixture", None)
            self.assertEqual(out["state"],"READONLY_VALIDATED")
            self.assertEqual(out["dashboard_validation"],{"state":"unverified"})

    def test_report_payload_and_transport_failure(self):
        from windows_resume import report_validation
        import proxy
        commit="a"*40
        expected={"schema":1,"commit":commit,"accounts":1,"adapter_readonly":"passed","hermes_cli_test_exit":0}
        with patch.object(proxy,"ENVIRONMENT",None),patch.object(proxy,"BYPASS_FILE",None),patch.object(proxy,"request") as request:
            request.return_value={"state":"reported","report":{**expected,"source":"controller_report","reportedAt":"2026-11-26T00:00:00.000Z"}}
            self.assertEqual(report_validation(commit,1,"fixture",None)["state"],"reported")
            request.assert_called_once_with("/hermes-validation","fixture",expected,"POST")
            request.side_effect=ValueError("private error")
            self.assertEqual(report_validation(commit,1,"fixture",None),{"state":"unverified"})


if __name__=="__main__":
    unittest.main()
