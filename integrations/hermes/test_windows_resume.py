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

if __name__=="__main__":
    unittest.main()
