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
    def test_trends(self):
        for val in ["one","two"]:
            self.s.run(["EVAL",APPEND,1,TRENDS,val])
        self.assertEqual(Store(self.path).run(["LRANGE",TRENDS,0,499]),["two","one"])

if __name__ == "__main__":
    unittest.main()
