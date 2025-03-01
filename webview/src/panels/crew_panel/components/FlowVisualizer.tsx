import React from 'react';

interface Visualization {
    type: 'graph' | 'tree' | 'sequence';
    data: any;
}

interface FlowVisualizerProps {
    visualizations: Visualization[];
}

export const FlowVisualizer: React.FC<FlowVisualizerProps> = ({ visualizations }) => {
    const renderVisualization = (visualization: Visualization) => {
        switch (visualization.type) {
            case 'graph':
                return (
                    <div className="graph-visualization">
                        {/* We can integrate with a graph visualization library like react-flow or mermaid */}
                        <pre>{JSON.stringify(visualization.data, null, 2)}</pre>
                    </div>
                );
            case 'tree':
                return (
                    <div className="tree-visualization">
                        <pre>{JSON.stringify(visualization.data, null, 2)}</pre>
                    </div>
                );
            case 'sequence':
                return (
                    <div className="sequence-visualization">
                        <pre>{JSON.stringify(visualization.data, null, 2)}</pre>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flow-visualizer">
            {visualizations.map((visualization, index) => (
                <div key={index} className="visualization-container">
                    {renderVisualization(visualization)}
                </div>
            ))}
        </div>
    );
};
