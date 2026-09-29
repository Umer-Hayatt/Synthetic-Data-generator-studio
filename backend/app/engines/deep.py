"""Optional SDV CPU adapter. Heavy imports happen only in a bounded child process."""
import importlib.util
import multiprocessing as mp
import os
from queue import Empty
from threading import Lock
import pandas as pd

_training_lock = Lock()


def _train_sample(queue, frame, kind, rows, seed, epochs):
    try:
        import random
        import numpy as np
        import torch
        from sdv.metadata import Metadata
        from sdv.single_table import CTGANSynthesizer, TVAESynthesizer
        torch.set_num_threads(1)
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        metadata = Metadata.detect_from_dataframe(data=frame)
        factory = CTGANSynthesizer if kind == 'ctgan' else TVAESynthesizer
        model = factory(metadata, epochs=epochs, enable_gpu=False, verbose=False)
        model.fit(frame)
        model.reset_sampling()
        queue.put(('ok', model.sample(num_rows=rows)))
    except Exception:
        queue.put(('error', None))


class DeepSynthesizer:
    def __init__(self, kind='ctgan', epochs=None, timeout=None):
        self.kind = kind
        self.epochs = epochs or int(os.getenv('DEEP_MAX_EPOCHS', '5'))
        self.timeout = timeout or float(os.getenv('DEEP_TIMEOUT_SECONDS', '120'))
        self.max_rows = int(os.getenv('DEEP_MAX_ROWS', '5000'))
        self.max_cells = int(os.getenv('DEEP_MAX_CELLS', '100000'))
        if not 1 <= self.epochs <= 100 or self.timeout <= 0:
            raise ValueError('Invalid deep training bounds.')

    def capabilities(self):
        installed = all(importlib.util.find_spec(name) is not None for name in ('sdv','ctgan','torch'))
        enabled = os.getenv('ENABLE_DEEP_SYNTHESIS', 'false').lower() == 'true'
        return {'engine':'deep_'+self.kind,'installed':installed,'enabled':enabled,
                'available':installed and enabled,'cpu':True,'max_rows':self.max_rows,
                'max_cells':self.max_cells,'timeout_seconds':self.timeout}

    def metadata(self):
        return {**self.capabilities(),'epochs':self.epochs,'seed':getattr(self,'seed',None),
                'note':'Experimental; no superiority claim. Fits and samples in one isolated process.'}

    def fit(self, source, target=None, seed=42):
        if not self.capabilities()['available']:
            raise ValueError('Optional deep capability is not installed/enabled.')
        if not isinstance(source,pd.DataFrame) or len(source) > self.max_rows or source.size > self.max_cells or len(source) < 20:
            raise ValueError('Deep training requires a bounded representative DataFrame of at least 20 rows.')
        if source.memory_usage(deep=True).sum() > 32 * 1024**2:
            raise ValueError('Deep source memory budget exceeded.')
        if any(source[c].nunique() > 100 for c in source.select_dtypes(include=['object','string'])):
            raise ValueError('High-cardinality text must be excluded from deep training.')
        self.frame, self.seed = source.copy(), seed
        return self

    def generate(self, row_count=None):
        rows = row_count or len(self.frame)
        if rows > self.max_rows or rows*len(self.frame.columns) > self.max_cells:
            raise ValueError('Deep generation budget exceeded.')
        if not _training_lock.acquire(blocking=False):
            raise ValueError('Another deep training operation is active.')
        context = mp.get_context('spawn')
        queue = context.Queue(maxsize=1)
        process = context.Process(target=_train_sample,
            args=(queue,self.frame,self.kind,rows,self.seed,self.epochs), daemon=True)
        try:
            process.start()
            try:
                status, result = queue.get(timeout=self.timeout)
            except Empty:
                raise ValueError('Deep training timed out.') from None
            if status != 'ok':
                raise ValueError('Deep training failed; statistical engine remains available.')
            if len(result) != rows or list(result.columns) != list(self.frame.columns):
                raise ValueError('Deep output violated schema/row-count contract.')
            return result
        finally:
            if process.pid:
                if process.is_alive(): process.terminate()
                process.join(timeout=5)
            queue.close()
            _training_lock.release()
