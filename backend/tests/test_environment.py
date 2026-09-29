import os
from pathlib import Path
import shutil
import subprocess
import sys

import pytest


@pytest.mark.parametrize(
    ('local_value', 'production_value', 'expected'),
    [('123', None, 123), ('123', '456', 456), (None, '456', 456)],
)
def test_root_environment_loading(tmp_path, local_value, production_value, expected):
    """Load from backend cwd, preserve production precedence, tolerate no file."""
    config = tmp_path / 'backend' / 'app' / 'core' / 'config.py'
    config.parent.mkdir(parents=True)
    shutil.copyfile(Path(__file__).parents[1] / 'app' / 'core' / 'config.py', config)
    if local_value is not None:
        (tmp_path / '.env').write_text(f'MAX_ROWS={local_value}\n', encoding='utf-8')
    env = {key: value for key, value in os.environ.items() if key != 'MAX_ROWS'}
    env.pop('PYTHON_DOTENV_DISABLED', None)
    if production_value is not None:
        env['MAX_ROWS'] = production_value
    result = subprocess.run(
        [sys.executable, '-c',
         'import runpy; print(runpy.run_path("app/core/config.py")["settings"].max_rows)'],
        cwd=tmp_path / 'backend', env=env, capture_output=True, text=True,
        check=True,
    )
    assert result.stdout.strip() == str(expected)
