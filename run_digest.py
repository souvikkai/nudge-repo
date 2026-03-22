import sys
import os
sys.path.insert(0, '/app')

import logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

from app.worker.digest import send_weekly_digest
send_weekly_digest()