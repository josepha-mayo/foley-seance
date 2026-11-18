import re, hashlib, importlib.util, json, tempfile, threading, unittest
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError
spec=importlib.util.spec_from_file_location("launcher",Path(__file__).with_name("run-local.py"));launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)
class LocalKitTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)/"dist";self.root.mkdir()
  for name in launcher.ASSETS:
   p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(("test "+name).encode())
 def tearDown(self):self.temp.cleanup()
 def test_app_imports_are_served(self):
  source=Path(__file__).with_name("app.mjs").read_text()
  for module in re.findall(r"from ['\"]\./([^'\"]+)['\"]",source):
   self.assertIn(module,launcher.ASSETS)
 def test_manifest_checks_exact_assets_and_corruption(self):
  expected={n:hashlib.sha256((self.root/n).read_bytes()).hexdigest() for n in launcher.ASSETS};manifest=self.root.parent/"bundle-manifest.json";manifest.write_text(json.dumps(expected));self.assertEqual(launcher.verify_bundle(self.root),self.root)
  (self.root/"app.mjs").write_text("changed")
  with self.assertRaises(ValueError):launcher.verify_bundle(self.root)
 def test_missing_asset_rejected_before_listener(self):
  (self.root/"app.mjs").unlink()
  with self.assertRaises(ValueError):launcher.verify_bundle(self.root)
 def test_loopback_static_only_http_and_shutdown(self):
  server=launcher.ThreadingHTTPServer(("127.0.0.1",0),launcher.handler_for(self.root));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();base="http://127.0.0.1:%d"%server.server_port
  try:
   self.assertEqual(server.server_address[0],"127.0.0.1")
   with urlopen(base+"/engine/foley-engine.mjs") as response:
    self.assertEqual(response.read(),b"test engine/foley-engine.mjs");self.assertEqual(response.headers["Cache-Control"],"no-store");self.assertIn("javascript",response.headers["Content-Type"])
   for path in ["/README.md","/../run-local.py","/%2e%2e/run-local.py","/engine/"]:
    with self.assertRaises(HTTPError) as error:urlopen(base+path)
    self.assertEqual(error.exception.code,404)
   with self.assertRaises(HTTPError) as error:urlopen(Request(base+"/",data=b"no audio endpoint",method="POST"))
   self.assertEqual(error.exception.code,501)
  finally:server.shutdown();server.server_close();thread.join(timeout=2)
  self.assertFalse(thread.is_alive())
if __name__=="__main__":unittest.main()
