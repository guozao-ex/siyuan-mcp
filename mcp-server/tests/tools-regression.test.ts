/**
 * 回归测试：针对本轮工具验收中发现的几个"静默失败"类缺陷。
 *
 * 这些缺陷的共同特点是**不报错但结果是错的**，没有测试就极易再次引入：
 *   1. 插入类工具取错数组层级 → 新块 ID 永远是 "unknown"
 *   2. batch_set_attrs 把整个对象当第一个参数传 → 属性写入静默失败却报 success
 *   3. read_document 把子块内容重复追加 → 正文出现两遍
 */
import { describe, it, expect, vi } from 'vitest';
import { appendBlock, renameDocument, deleteDocument } from '../src/tools/write';
import { readDocument } from '../src/tools/read';
import { findBlockRow } from '../src/core/block-index';

describe('appendBlock 的块 ID 提取', () => {
  it('应从 data[0].doOperations[0].id 取到真实块 ID（思源把 data 包了一层数组）', async () => {
    const client = {
      appendBlock: vi.fn().mockResolvedValue([
        {
          timestamp: 0,
          doOperations: [{ action: 'insert', id: '20260916201223-35c4sl6', data: '<div/>' }],
        },
      ]),
    };

    const result = await appendBlock(client as any, {
      parentId: '20240101120000-parent1',
      content: 'hi',
    });

    expect(result.id).toBe('20260916201223-35c4sl6');
    expect(result.id).not.toBe('unknown');
  });

  it('返回结构异常时应回退为 unknown，而不是抛错', async () => {
    const client = { appendBlock: vi.fn().mockResolvedValue([]) };
    const result = await appendBlock(client as any, { parentId: 'p', content: 'x' });
    expect(result.id).toBe('unknown');
  });
});

describe('batch_set_attrs 的参数传递', () => {
  it('必须以 (id, attrs) 两个参数调用 setBlockAttrs', async () => {
    const client = {
      setBlockAttrs: vi.fn().mockResolvedValue(undefined),
    };

    const { BatchOperations } = await import('../src/core/batch-operations');
    const ops = new BatchOperations(client);
    const result = await ops.setBlockAttrsBatch([
      { id: '20240101120000-block1', attrs: { 'custom-k': 'v' } },
    ]);

    expect(result.successful).toBe(1);
    expect(result.failed).toBe(0);
    // 关键：第一个参数是**字符串 id**，不是 { id, attrs } 对象
    expect(client.setBlockAttrs).toHaveBeenCalledWith('20240101120000-block1', {
      'custom-k': 'v',
    });
    const firstArg = client.setBlockAttrs.mock.calls[0][0];
    expect(typeof firstArg).toBe('string');
    expect(client.setBlockAttrs.mock.calls[0][1]).toBeDefined();
  });

  it('写入失败时应如实记为 failed（不得谎报成功）', async () => {
    const client = {
      setBlockAttrs: vi.fn().mockRejectedValue(new Error('boom')),
    };

    const { BatchOperations } = await import('../src/core/batch-operations');
    const ops = new BatchOperations(client);
    const result = await ops.setBlockAttrsBatch([{ id: 'b1', attrs: { a: 'b' } }]);

    expect(result.successful).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0].error).toContain('boom');
  });
});

describe('readDocument 不得重复正文', () => {
  it('文档 kramdown 已含子块，不应再逐个追加一遍', async () => {
    // 模拟思源：getBlockKramdown(文档) 返回整篇内容
    const fullDoc = '# 标题\n\npara one\n\npara two';
    const client = {
      getDocInfo: vi.fn().mockResolvedValue({ name: 'diag', refCount: 0, subFileCount: 0 }),
      getBlockKramdown: vi.fn().mockResolvedValue({ id: 'doc1', kramdown: fullDoc }),
      // 若实现仍去逐个取子块，这个 mock 会暴露调用
      sql: vi
        .fn()
        .mockResolvedValue([
          { id: 'doc1', content: '标题', created: '20240101000000', updated: '20240101000000' },
        ]),
    };

    const result = await readDocument(client as any, {
      id: 'doc1',
      includeChildren: true,
    });

    const occurrences = (result.markdown.match(/para two/g) || []).length;
    expect(occurrences).toBe(1);
    // 且**不应**为子块再发请求（旧实现是 N+1）
    const kramdownCalls = client.getBlockKramdown.mock.calls.length;
    expect(kramdownCalls).toBe(1);
  });
});

describe('renameDocument / deleteDocument 不依赖思源的返回值', () => {
  // 思源的 /api/filetree/renameDoc 与 /removeDoc 都返回 data: null。
  // 旧实现去读 response.id，于是抛 "Cannot read properties of null (reading 'id')"。

  it('renameDoc 返回空时不应抛错，并回填传入的文档 id', async () => {
    const client = { renameDoc: vi.fn().mockResolvedValue(undefined) };

    const result = await renameDocument(client as any, {
      notebook: 'nb1',
      path: '/a.sy',
      newTitle: '新标题',
      id: '20240101120000-doc1',
    });

    expect(result.id).toBe('20240101120000-doc1');
    expect(result.message).toContain('新标题');
  });

  it('removeDoc 返回空时不应抛错', async () => {
    const client = { removeDoc: vi.fn().mockResolvedValue(undefined) };

    const result = await deleteDocument(client as any, {
      notebook: 'nb1',
      path: '/a.sy',
      id: '20240101120000-doc2',
    });

    expect(result.id).toBe('20240101120000-doc2');
    expect(result.message).toContain('deleted');
  });

  it('未提供 id 时退回用 path 作为结果标识', async () => {
    const client = { removeDoc: vi.fn().mockResolvedValue(undefined) };
    const result = await deleteDocument(client as any, { notebook: 'nb', path: '/x.sy' });
    expect(result.id).toBe('/x.sy');
  });
});

describe('findBlockRow 的索引等待', () => {
  it('前几次查不到、随后命中时应返回该行（模拟索引延迟）', async () => {
    let calls = 0;
    const client = {
      sql: vi.fn().mockImplementation(async () => {
        calls += 1;
        return calls < 3 ? [] : [{ id: '20240101120000-b1', content: 'x' }];
      }),
    };

    const row = await findBlockRow(client as any, '20240101120000-b1', 2000);

    expect(row).not.toBeNull();
    expect(row?.id).toBe('20240101120000-b1');
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('超时仍未命中时返回 null（真的不存在）', async () => {
    const client = { sql: vi.fn().mockResolvedValue([]) };
    const row = await findBlockRow(client as any, 'not-a-real-id', 300);
    expect(row).toBeNull();
  });

  it('查询本身抛错时也应继续重试，而不是直接失败', async () => {
    let calls = 0;
    const client = {
      sql: vi.fn().mockImplementation(async () => {
        calls += 1;
        if (calls < 2) throw new Error('index not ready');
        return [{ id: 'b2' }];
      }),
    };

    const row = await findBlockRow(client as any, 'b2', 2000);
    expect(row?.id).toBe('b2');
  });
});
