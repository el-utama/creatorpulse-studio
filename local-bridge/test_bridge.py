import concurrent.futures
import tempfile
import time
import unittest
from pathlib import Path
from bridge import Store, VAULT, POSTS, TRENDS, ENROLL, CREATE, CAS, APPEND, UNLOCK

class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)/"test.sqlite3"
        self.s = Store(self.path)
    def tearDown(self):
        self.tmp.cleanup()
    def test_enrollment_and_restart(self):
        for i in range(3):
            self.assertEqual(self.s.run(["EVAL",ENROLL,1,VAULT,str(i)*32,"sealed"]),1)
        self.assertEqual(self.s.run(["EVAL",ENROLL,1,VAULT,"3"*32,"sealed"]),0)
        self.assertEqual(Store(self.path).run(["HGET",VAULT,"0"*32]),"sealed")
        self.assertEqual(len(Store(self.path).run(["HGETALL",VAULT])),6)
    def test_atomic_post_claim(self):
        id = "00000000-0000-4000-8000-000000000001"
        self.assertEqual(self.s.run(["EVAL",CREATE,1,POSTS,id,"draft"]),1)
        self.assertEqual(self.s.run(["EVAL",CREATE,1,POSTS,id,"draft"]),2)
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda i:self.s.run(["EVAL",CAS,1,POSTS,id,"draft",str(i)]),range(8)))
        self.assertEqual(sum(results),1)
    def test_rate_limit_persistent(self):
        from unittest.mock import patch
        with patch("bridge.time.time",return_value=120):
            for i in range(65): self.assertEqual(self.s.run(["RATE_AGENT"]),min(i+1,61))
            self.assertEqual(Store(self.path).run(["RATE_AGENT"]),61)
        with patch("bridge.time.time",return_value=180): self.assertEqual(self.s.run(["RATE_AGENT"]),1)
    def test_archive_retains_identity(self):
        id = "00000000-0000-4000-8000-000000000002"
        self.assertEqual(self.s.run(["EVAL",CREATE,1,POSTS,id,"done"]),1)
        self.assertEqual(self.s.run(["ARCHIVE_POST",id,"wrong"]),0)
        self.assertEqual(self.s.run(["ARCHIVE_POST",id,"done"]),1)
        self.assertEqual(self.s.run(["HKEYS",POSTS]),[])
        self.assertEqual(self.s.run(["HGET",POSTS+":archived",id]),"done")
        self.assertEqual(self.s.run(["EVAL",CREATE,1,POSTS,id,"new"]),2)
    def test_lock_and_idempotency(self):
        lock = "creatorpulse:v3:lock:"+"a"*32
        key = "creatorpulse:publish:v1:"+"b"*64
        self.assertEqual(self.s.run(["SET",lock,"a"*48,"NX","PX",60000]),"OK")
        self.assertIsNone(self.s.run(["SET",lock,"b"*48,"NX","PX",60000]))
        self.assertEqual(self.s.run(["EVAL",UNLOCK,1,lock,"b"*48]),0)
        self.assertEqual(self.s.run(["EVAL",UNLOCK,1,lock,"a"*48]),1)
        self.assertEqual(self.s.run(["SET",key,"pending","EX",86400,"NX"]),"OK")
        self.assertIsNone(Store(self.path).run(["SET",key,"again","EX",86400,"NX"]))
        self.assertEqual(self.s.run(["GET",key]),"pending")
    def test_reject_arbitrary_commands(self):
        for command in [["EVAL","return 1",1,VAULT,"a"*32],["HGET","other","a"*32],["FLUSHALL"],["HDEL",POSTS,"a"*32]]:
            with self.assertRaises(ValueError):
                self.s.run(command)
    def test_manual_history_is_durable_scoped_and_deduplicated(self):
        account="a"*32
        other="b"*32
        request="00000000-0000-4000-8000-000000000003"
        publish="v_inbox_file~v2.123"
        self.assertEqual(self.s.run(["MANUAL_CAPS"]),1)
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            attempts=list(pool.map(lambda _:self.s.run(["MANUAL_BEGIN",account,request,"inbox"]),range(6)))
        self.assertEqual(sum(x is None for x in attempts),1)
        self.assertEqual(self.s.run(["MANUAL_ACCEPT",account,request,publish]),1)
        self.assertEqual(self.s.run(["MANUAL_STATUS",account,publish,"SEND_TO_USER_INBOX",""]),1)
        self.assertEqual(self.s.run(["MANUAL_STATUS",other,publish,"FAILED","video_pull_failed"]),0)
        self.assertEqual(self.s.run(["MANUAL_STATUS",account,publish,"PUBLISH_COMPLETE",""]),1)
        self.assertEqual(self.s.run(["MANUAL_STATUS",account,publish,"PROCESSING_UPLOAD",""]),0)
        self.assertEqual(self.s.run(["MANUAL_IMPORT",account,publish,"2025-01-01T00:00:00.000Z","inbox","SEND_TO_USER_INBOX",""])["imported"],0)
        self.assertEqual(self.s.run(["MANUAL_IMPORT",account,"legacy-1","2025-01-01T00:00:00.000Z","unknown","SEND_TO_USER_INBOX",""])["imported"],1)
        reopened=Store(self.path)
        self.assertEqual(len(reopened.run(["MANUAL_LIST",account])),2)
        self.assertEqual(reopened.run(["MANUAL_LIST",other]),[])
        self.assertEqual(reopened.run(["MANUAL_BEGIN",account,request,"inbox"])["id"],publish)
        self.assertEqual(reopened.run(["MANUAL_BEGIN",account,request,"inbox"])["status"],"PUBLISH_COMPLETE")
        with self.assertRaises(ValueError): self.s.run(["MANUAL_LIST","../"])
        with self.assertRaises(ValueError): self.s.run(["MANUAL_IMPORT",account,"legacy-2","2039-01-01T00:00:00.000Z","unknown","FAILED",""])
    def test_trends(self):
        for val in ["one","two"]:
            self.s.run(["EVAL",APPEND,1,TRENDS,val])
        self.assertEqual(Store(self.path).run(["LRANGE",TRENDS,0,499]),["two","one"])

if __name__ == "__main__":
    unittest.main()
