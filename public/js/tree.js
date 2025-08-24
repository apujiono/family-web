async function loadFamilyTree() {
  queueGtagEvent('load_family_tree', { event_category: 'tree', event_label: 'tree_load' });
  await retryFetch(async () => {
    const res = await fetch(`${API_URL}/family-tree`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (res.status === 401) {
      if (await refreshToken()) return loadFamilyTree();
    }
    const tree = await res.json();
    const width = 800, height = 600;
    const svg = d3.select('#familyTree')
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    const g = svg.append('g').attr('transform', 'translate(40,0)');
    const treeLayout = d3.tree().size([height - 100, width - 100]);
    const root = d3.hierarchy(tree);
    treeLayout(root);
    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', d3.linkHorizontal().x(d => d.y).y(d => d.x))
      .attr('fill', 'none')
      .attr('stroke', '#00FFFF');
    g.selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .append('text')
      .attr('dy', '.35em')
      .attr('x', d => d.children ? -10 : 10)
      .text(d => d.data.name);
    queueGtagEvent('family_tree_loaded', { event_category: 'tree', event_label: 'tree_displayed' });
  });
}

loadFamilyTree();