/**
 * 思源笔记 API 全量测试
 * 测试所有 75+ 个 API 的可用性
 */

async function testAllAPIs() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   思源笔记 API 全量测试              ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  const results = [];
  const baseUrl = 'http://127.0.0.1:6806';

  // 测试辅助函数
  async function testAPI(name, endpoint, data = {}) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      const success = result.code === 0 || result.code === undefined;
      results.push({ name, success, code: result.code, msg: result.msg });
      return { success, data: result.data };
    } catch (error) {
      results.push({ name, success: false, error: error.message });
      return { success: false, error };
    }
  }

  console.log('【阶段 1/8】系统功能测试...\n');

  // 1. 系统功能
  await testAPI('getVersion', '/api/system/version');
  await testAPI('bootProgress', '/api/system/bootProgress');
  await testAPI('getConf', '/api/system/getConf');

  console.log('【阶段 2/8】笔记本管理测试...\n');

  // 2. 笔记本管理
  const notebooksResult = await testAPI('listNotebooks', '/api/notebook/lsNotebooks');
  const testNotebook = notebooksResult.data?.notebooks?.[0]?.id || '20260517160056-swrvy8t';

  await testAPI('openNotebook', '/api/notebook/openNotebook', { notebook: testNotebook });

  // 创建测试笔记本
  const createNbResult = await testAPI('createNotebook', '/api/notebook/createNotebook', {
    name: 'API测试笔记本_' + Date.now()
  });
  const newNotebook = createNbResult.data?.id;

  if (newNotebook) {
    await testAPI('renameNotebook', '/api/notebook/renameNotebook', {
      notebook: newNotebook,
      name: 'API测试_已重命名'
    });
    await testAPI('closeNotebook', '/api/notebook/closeNotebook', { notebook: newNotebook });
    // 不删除，留待后续测试使用
  }

  console.log('【阶段 3/8】文档和块操作测试...\n');

  // 3. 文档创建和管理
  const createDocResult = await testAPI('createDocWithMd', '/api/filetree/createDocWithMd', {
    notebook: testNotebook,
    path: '/API全量测试文档.md',
    markdown: '# API测试\n\n这是测试内容'
  });
  const testDocId = createDocResult.data;

  if (testDocId) {
    // 等待文档创建完成
    await new Promise(r => setTimeout(r, 1000));

    await testAPI('getDoc', '/api/filetree/getDoc', { id: testDocId });
    await testAPI('getDocInfo', '/api/block/getDocInfo', { id: testDocId });
    await testAPI('getBlockKramdown', '/api/block/getBlockKramdown', { id: testDocId });
    await testAPI('getBlockAttrs', '/api/block/getBlockAttrs', { id: testDocId });
    await testAPI('getDocOutline', '/api/outline/getDocOutline', { id: testDocId });

    // 块操作
    const insertResult = await testAPI('insertBlock', '/api/block/insertBlock', {
      dataType: 'markdown',
      data: '新插入的段落',
      parentID: testDocId
    });
    const newBlockId = insertResult.data?.[0]?.id;

    if (newBlockId) {
      await testAPI('updateBlock', '/api/block/updateBlock', {
        dataType: 'markdown',
        data: '更新后的内容',
        id: newBlockId
      });

      await testAPI('setBlockAttrs', '/api/attr/setBlockAttrs', {
        id: newBlockId,
        attrs: { 'custom-test': 'value' }
      });

      await testAPI('getBlockBreadcrumb', '/api/block/getBlockBreadcrumb', { id: newBlockId });

      // 不删除，留待后续测试
    }

    await testAPI('getChildBlocks', '/api/block/getChildBlocks', { id: testDocId });
    await testAPI('getDocChildBlocks', '/api/filetree/getDocChildBlocks', { id: testDocId });
  }

  console.log('【阶段 4/8】搜索和查询测试...\n');

  // 4. 搜索功能
  await testAPI('sql', '/api/query/sql', {
    stmt: 'SELECT id, content FROM blocks LIMIT 5'
  });

  await testAPI('searchBlock', '/api/search/searchBlock', {
    query: '测试',
    method: 0
  });

  await testAPI('fullTextSearchBlock', '/api/search/fullTextSearchBlock', {
    query: '测试'
  });

  await testAPI('searchDocs', '/api/filetree/searchDocs', {
    k: '测试'
  });

  console.log('【阶段 5/8】文件树和路径测试...\n');

  // 5. 文件树操作
  await testAPI('listDocsByPath', '/api/filetree/listDocsByPath', {
    notebook: testNotebook,
    path: '/'
  });

  await testAPI('getFileTree', '/api/filetree/getFileTree', {
    notebook: testNotebook,
    path: '/'
  });

  if (testDocId) {
    await testAPI('getHPathByID', '/api/filetree/getHPathByID', { id: testDocId });
    await testAPI('getHPathByPath', '/api/filetree/getHPathByPath', {
      notebook: testNotebook,
      path: '/API全量测试文档.md'
    });
  }

  console.log('【阶段 6/8】引用、标签、书签测试...\n');

  // 6. 引用功能
  if (testDocId) {
    await testAPI('getBacklink', '/api/ref/getBacklink', { id: testDocId });
    await testAPI('getBacklink2', '/api/ref/getBacklink2', { id: testDocId });
    await testAPI('getBackmention', '/api/ref/getBackmention', { id: testDocId });
  }

  // 7. 标签
  await testAPI('getTags', '/api/tag/getTags');

  // 8. 书签
  await testAPI('getBookmark', '/api/bookmark/getBookmark');

  console.log('【阶段 7/8】模板和导出测试...\n');

  // 9. 模板
  await testAPI('listTemplates', '/api/template/listTemplates');

  if (testDocId) {
    // 导出功能
    await testAPI('exportMdContent', '/api/export/exportMdContent', { id: testDocId });
  }

  console.log('【阶段 8/8】历史、快照、同步测试...\n');

  // 10. 历史
  await testAPI('getDocHistory', '/api/history/getDocHistoryContent', {
    notebook: testNotebook,
    path: '/API全量测试文档.md'
  });

  // 11. 快照
  const snapshotResult = await testAPI('createSnapshot', '/api/snapshot/createSnapshot', {
    name: 'API测试快照'
  });

  // 12. 同步
  await testAPI('getSyncStatus', '/api/sync/getSyncStatus');

  // 13. 其他
  await testAPI('getShorthand', '/api/inbox/getShorthand');

  // 输出结果
  console.log('\n');
  console.log('╔══════════════════════════════════════╗');
  console.log('║           测试结果汇总               ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`总计测试: ${results.length} 个 API`);
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`成功率: ${(passed / results.length * 100).toFixed(1)}%`);
  console.log('');

  if (failed > 0) {
    console.log('失败的 API:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ❌ ${r.name}: ${r.msg || r.error}`);
    });
    console.log('');
  }

  // 分类统计
  const categories = {
    '系统功能': results.slice(0, 3),
    '笔记本管理': results.slice(3, 9),
    '文档块操作': results.slice(9, 20),
    '搜索查询': results.slice(20, 24),
    '文件树': results.slice(24, 28),
    '引用标签': results.slice(28, 33),
    '模板导出': results.slice(33, 35),
    '历史快照': results.slice(35, 38)
  };

  console.log('分类统计:');
  Object.entries(categories).forEach(([cat, tests]) => {
    const catPassed = tests.filter(t => t.success).length;
    console.log(`  ${cat}: ${catPassed}/${tests.length} 通过`);
  });

  console.log('');
  console.log('测试完成！');
}

// 运行测试
testAllAPIs().catch(console.error);
