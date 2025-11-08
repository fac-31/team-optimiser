<script lang="ts">
  import { onMount } from 'svelte';
  import { historyStore } from '$lib/stores/historyStore';

  interface Person {
    id: string;
    name: string;
  }

  interface ConflictMatrix {
    [personId: string]: {
      [personId: string]: number;
    };
  }

  interface Edge {
    source: string;
    target: string;
    weight: number;
  }

  interface Node {
    id: string;
    name: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    totalCollaborations: number;
  }

  // Initialize with empty state (will be populated from store on mount)
  let people = $state<Person[]>([]);
  let conflictMatrix = $state<ConflictMatrix>({});
  let nodes = $state<Node[]>([]);
  let edges = $state<Edge[]>([]);
  let hasData = $state(false);

  let loading = $state(false);
  let error = $state<string>('');
  let fileInputElement: HTMLInputElement | null = null;

  // Load data from store on mount (client-side only)
  onMount(() => {
    const unsubscribe = historyStore.subscribe(storeData => {
      people = storeData.people;
      conflictMatrix = storeData.conflictMatrix;
      nodes = storeData.nodes;
      edges = storeData.edges;
      hasData = storeData.hasData;
    });

    return unsubscribe;
  });

  // Interaction state
  let draggedNode = $state<Node | null>(null);
  let svgElement = $state<SVGSVGElement | null>(null);
  let viewBox = $state({ x: 0, y: 0, width: 1200, height: 800 });
  let zoom = $state(1);
  let isPanning = $state(false);
  let panStart = { x: 0, y: 0 };
  let showLabels = $state(true);

  const WIDTH = 1200;
  const HEIGHT = 800;
  const REPULSION = 20000;  // Increased for more spreading
  const ATTRACTION = 0.005;  // Decreased to reduce clustering
  const DAMPING = 0.6;       // More aggressive damping

  function loadTeamData(data: any) {
    try {
      // Validate data structure
      if (!data.people || !Array.isArray(data.people)) {
        throw new Error('Invalid data format: missing or invalid "people" array');
      }
      if (!data.conflictMatrix || typeof data.conflictMatrix !== 'object') {
        throw new Error('Invalid data format: missing or invalid "conflictMatrix" object');
      }

      people = data.people;
      conflictMatrix = data.conflictMatrix;

      // Calculate total collaborations per person
      const collaborationCounts: { [id: string]: number } = {};
      for (const person of people) {
        let total = 0;
        if (conflictMatrix[person.id]) {
          total = Object.values(conflictMatrix[person.id]).reduce((sum, val) => sum + val, 0);
        }
        collaborationCounts[person.id] = total;
      }

      // Initialize nodes with random positions spread across the canvas
      const margin = 150;
      nodes = people.map(person => ({
        id: person.id,
        name: person.name,
        x: margin + Math.random() * (WIDTH - 2 * margin),
        y: margin + Math.random() * (HEIGHT - 2 * margin),
        vx: 0,
        vy: 0,
        totalCollaborations: collaborationCounts[person.id] || 0
      }));

      // Build edges from conflict matrix
      const edgeList: Edge[] = [];
      for (const [sourceId, targets] of Object.entries(conflictMatrix)) {
        for (const [targetId, weight] of Object.entries(targets)) {
          // Only add each edge once (avoid duplicates)
          if (parseInt(sourceId) < parseInt(targetId)) {
            edgeList.push({
              source: sourceId,
              target: targetId,
              weight
            });
          }
        }
      }
      edges = edgeList;

      // Run force-directed layout simulation
      runSimulation();

      hasData = true;
      error = '';

      // Persist to store
      historyStore.set({
        people,
        conflictMatrix,
        nodes,
        edges,
        hasData: true
      });
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load data';
      console.error('Error loading history:', err);
      hasData = false;
    }
  }

  function handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!file.name.endsWith('.json')) {
      error = 'Please upload a JSON file';
      return;
    }

    loading = true;
    error = '';

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        loadTeamData(data);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to parse JSON file';
        console.error('Error parsing file:', err);
        hasData = false;
      } finally {
        loading = false;
      }
    };

    reader.onerror = () => {
      error = 'Failed to read file';
      loading = false;
      hasData = false;
    };

    reader.readAsText(file);
  }

  function triggerFileUpload() {
    fileInputElement?.click();
  }

  function runSimulation() {
    const iterations = 500;  // Increased iterations for better layout

    for (let iter = 0; iter < iterations; iter++) {
      // Apply forces

      // 1. Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const distSq = dx * dx + dy * dy;
          const dist = Math.sqrt(distSq);

          if (dist > 0) {
            const force = REPULSION / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }
      }

      // 2. Attraction along edges
      for (const edge of edges) {
        const source = nodes.find(n => n.id === edge.source);
        const target = nodes.find(n => n.id === edge.target);

        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 0) {
            const force = ATTRACTION * dist * Math.log(edge.weight + 1);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
          }
        }
      }

      // 3. Update positions with damping
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= DAMPING;
        node.vy *= DAMPING;

        // Keep nodes within bounds
        const margin = 100;
        node.x = Math.max(margin, Math.min(WIDTH - margin, node.x));
        node.y = Math.max(margin, Math.min(HEIGHT - margin, node.y));
      }
    }
  }

  function getEdgeWidth(weight: number): number {
    return Math.max(1, Math.min(10, weight * 1.5));
  }

  function getEdgeOpacity(weight: number): number {
    return Math.max(0.3, Math.min(1, weight * 0.15));
  }

  function getNode(id: string): Node | undefined {
    return nodes.find(n => n.id === id);
  }

  function getNodeRadius(node: Node): number {
    // Base radius between 8 and 20 based on collaboration count
    const minRadius = 8;
    const maxRadius = 20;
    const maxCollabs = Math.max(...nodes.map(n => n.totalCollaborations), 1);
    return minRadius + (node.totalCollaborations / maxCollabs) * (maxRadius - minRadius);
  }

  // Drag and drop handlers
  function handleMouseDown(event: MouseEvent, node: Node) {
    if (event.button === 0) { // Left mouse button
      draggedNode = node;
      event.preventDefault();
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (draggedNode && svgElement) {
      const rect = svgElement.getBoundingClientRect();
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;

      draggedNode.x = viewBox.x + (event.clientX - rect.left) * scaleX;
      draggedNode.y = viewBox.y + (event.clientY - rect.top) * scaleY;

      // Reset velocity when dragging
      draggedNode.vx = 0;
      draggedNode.vy = 0;

      // Persist node position changes
      historyStore.update(store => ({ ...store, nodes }))
    } else if (isPanning && svgElement) {
      const dx = event.clientX - panStart.x;
      const dy = event.clientY - panStart.y;

      const rect = svgElement.getBoundingClientRect();
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;

      viewBox.x -= dx * scaleX;
      viewBox.y -= dy * scaleY;

      panStart = { x: event.clientX, y: event.clientY };
    }
  }

  function handleMouseUp() {
    draggedNode = null;
    isPanning = false;
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));

    if (svgElement) {
      const rect = svgElement.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;

      const worldX = viewBox.x + mouseX * scaleX;
      const worldY = viewBox.y + mouseY * scaleY;

      const newWidth = WIDTH / newZoom;
      const newHeight = HEIGHT / newZoom;

      viewBox = {
        x: worldX - (mouseX / rect.width) * newWidth,
        y: worldY - (mouseY / rect.height) * newHeight,
        width: newWidth,
        height: newHeight
      };

      zoom = newZoom;
    }
  }

  function startPan(event: MouseEvent) {
    if (event.button === 0 && !draggedNode) {
      isPanning = true;
      panStart = { x: event.clientX, y: event.clientY };
      event.preventDefault();
    }
  }

  function resetView() {
    viewBox = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
    zoom = 1;
  }

  function rerunLayout() {
    // Re-randomize positions
    const margin = 150;
    nodes = nodes.map(node => ({
      ...node,
      x: margin + Math.random() * (WIDTH - 2 * margin),
      y: margin + Math.random() * (HEIGHT - 2 * margin),
      vx: 0,
      vy: 0
    }));
    runSimulation();

    // Persist layout changes
    historyStore.update(store => ({ ...store, nodes }));
  }
</script>

<svelte:window
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
/>

<main>
  <h1>Collaboration History</h1>
  <p>Visual representation of past team collaborations. Node size and edge thickness indicate collaboration frequency.</p>

  <div class="upload-section">
    <input
      type="file"
      accept=".json"
      bind:this={fileInputElement}
      onchange={handleFileUpload}
      style="display: none"
    />
    <button onclick={triggerFileUpload} class="upload-button">
      Upload Team History
    </button>
    {#if loading}
      <span class="loading-text">Loading...</span>
    {/if}
  </div>

  {#if error}
    <div class="error">Error: {error}</div>
  {/if}

  {#if hasData}
    <div class="stats">
      <div>Total Contributors: <strong>{people.length}</strong></div>
      <div>Total Collaborations: <strong>{edges.length}</strong></div>
      <div>Most Frequent Collaboration: <strong>{Math.max(...edges.map(e => e.weight))} times</strong></div>
      <div>Zoom: <strong>{zoom.toFixed(2)}x</strong></div>
    </div>

    <div class="controls">
      <button onclick={resetView}>Reset View</button>
      <button onclick={rerunLayout}>Regenerate Layout</button>
      <label>
        <input type="checkbox" bind:checked={showLabels} />
        Show Labels
      </label>
    </div>

    <div class="instructions">
      <strong>Controls:</strong>
      Scroll to zoom • Drag background to pan • Drag nodes to reposition
    </div>

    <div class="graph-container">
      <svg
        bind:this={svgElement}
        width={WIDTH}
        height={HEIGHT}
        viewBox="{viewBox.x} {viewBox.y} {viewBox.width} {viewBox.height}"
        onwheel={handleWheel}
        onmousedown={startPan}
        style="cursor: {draggedNode ? 'grabbing' : isPanning ? 'grabbing' : 'grab'}"
        role="img"
        aria-label="Collaboration graph visualization"
      >
        <!-- Edges -->
        <g class="edges">
          {#each edges as edge}
            {@const source = getNode(edge.source)}
            {@const target = getNode(edge.target)}
            {#if source && target}
              <g class="edge-group">
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#999"
                  stroke-width={getEdgeWidth(edge.weight)}
                  opacity={getEdgeOpacity(edge.weight)}
                />
                <!-- Edge label (collaboration count) -->
                <text
                  x={(source.x + target.x) / 2}
                  y={(source.y + target.y) / 2}
                  class="edge-label"
                  text-anchor="middle"
                  dominant-baseline="middle"
                >
                  {edge.weight}
                </text>
              </g>
            {/if}
          {/each}
        </g>

        <!-- Nodes -->
        <g class="nodes">
          {#each nodes as node}
            {@const radius = getNodeRadius(node)}
            <g class="node-group">
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill="#007bff"
                stroke="#fff"
                stroke-width="2"
                onmousedown={(e) => handleMouseDown(e, node)}
                style="cursor: pointer"
                role="button"
                aria-label="Drag {node.name}"
                tabindex="0"
              />
              {#if showLabels}
                <text
                  x={node.x}
                  y={node.y - radius - 5}
                  class="node-label"
                  text-anchor="middle"
                >
                  {node.name}
                </text>
              {/if}
            </g>
          {/each}
        </g>
      </svg>
    </div>
  {/if}
</main>

<style>
  main {
    max-width: 1400px;
    margin: 20px auto;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  h1 {
    color: #333;
    margin-top: 0;
  }

  p {
    color: #666;
    margin-bottom: 20px;
  }

  .upload-section {
    display: flex;
    align-items: center;
    gap: 15px;
    margin: 25px 0;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 6px;
    border: 2px dashed #ccc;
  }

  .upload-button {
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: #28a745;
    color: white;
    transition: background 0.2s;
  }

  .upload-button:hover {
    background: #218838;
  }

  .loading-text {
    color: #666;
    font-size: 14px;
  }

  .error {
    background: #fee;
    color: #c33;
    padding: 15px;
    border-radius: 4px;
    margin: 20px 0;
    border: 1px solid #fcc;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin: 20px 0;
    padding: 20px;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .stats div {
    font-size: 14px;
    color: #555;
  }

  .controls {
    display: flex;
    gap: 15px;
    align-items: center;
    margin: 15px 0;
    padding: 15px;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .controls button {
    padding: 8px 16px;
    font-size: 14px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background: #007bff;
    color: white;
    transition: background 0.2s;
  }

  .controls button:hover {
    background: #0056b3;
  }

  .controls label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: #555;
    cursor: pointer;
  }

  .controls input[type="checkbox"] {
    cursor: pointer;
  }

  .instructions {
    padding: 12px;
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 4px;
    margin-bottom: 15px;
    font-size: 14px;
    color: #856404;
  }

  .graph-container {
    margin: 15px 0;
    border: 2px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
    background: #fafafa;
    box-shadow: inset 0 0 10px rgba(0,0,0,0.05);
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    user-select: none;
  }

  .node-label {
    font-size: 11px;
    font-weight: 600;
    fill: #333;
    pointer-events: none;
    user-select: none;
    paint-order: stroke;
    stroke: white;
    stroke-width: 3px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .edge-label {
    font-size: 10px;
    font-weight: 700;
    fill: #d32f2f;
    pointer-events: none;
    user-select: none;
    paint-order: stroke;
    stroke: white;
    stroke-width: 3px;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .node-group circle {
    transition: fill 0.2s;
  }

  .node-group:hover circle {
    fill: #0056b3;
  }
</style>
