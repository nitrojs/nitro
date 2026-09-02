;; Text source of `sum.wasm` (kept for reference, not part of the build).
(module
  (func (export "sum") (param i32 i32) (result i32)
    local.get 0
    local.get 1
    i32.add))
