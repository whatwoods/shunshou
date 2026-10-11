# 权重按 fp16 存，图开头插 Cast 转回 fp32：下载体积减半，计算仍是 fp32（ORT 建会话时会把 Cast 常量折叠掉）
import sys, numpy as np, onnx
from onnx import helper, numpy_helper, TensorProto
src, dst = sys.argv[1], sys.argv[2]
m = onnx.load(src)
g = m.graph
keep = g.output[0].name
del g.output[1:]
# 去掉只为旁支输出服务的节点
needed = {keep}; nodes = list(g.node)
alive = []
for n in reversed(nodes):
    if any(o in needed for o in n.output):
        alive.append(n); needed.update(n.input)
alive.reverse()
del g.node[:]; g.node.extend(alive)
used = {i for n in alive for i in n.input}
inits = [t for t in g.initializer if t.name in used]
new_inits, casts = [], []
for t in inits:
    a = numpy_helper.to_array(t)
    if a.dtype == np.float32 and a.size > 16:
        h = numpy_helper.from_array(a.astype(np.float16), t.name + '__fp16')
        new_inits.append(h)
        casts.append(helper.make_node('Cast', [h.name], [t.name], to=TensorProto.FLOAT, name=t.name + '__cast'))
    else:
        new_inits.append(t)
del g.initializer[:]; g.initializer.extend(new_inits)
for n in reversed(casts): g.node.insert(0, n)
onnx.checker.check_model(m)
onnx.save(m, dst)
print('nodes', len(alive), 'casts', len(casts))
