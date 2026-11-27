from dataclasses import replace
import pytest
from fastapi.testclient import TestClient
from zurikatos.api import Settings, create_app
from zurikatos.network import demo_network
from zurikatos.planner import GreedyPlanner
from zurikatos.simulation import Simulation


def test_routes_cover_every_side_once_and_follow_allowed_directions():
    network = demo_network()
    routes = GreedyPlanner().plan(network, 64)
    task_ids = []
    assert len(routes) == 5
    for route in routes:
        current = network.depot
        assert any(leg.task_id for leg in route)
        for leg in route:
            edge = network.edges[leg.edge_id]
            assert edge.allowed
            assert edge.source == current
            current = edge.target
            if leg.task_id:
                assert network.tasks[leg.task_id].edge_id == edge.id
                task_ids.append(leg.task_id)
        assert current == network.depot
        assert sum(leg.task_id is not None for leg in route) * 8 <= 64
    assert len(task_ids) == len(set(task_ids)) == 24
    assert set(task_ids) == set(network.tasks)


def test_shortest_path_does_not_reverse_one_way_roads_or_use_excluded_edges():
    network = demo_network()
    _, path = network.shortest_path('n10', 'n00')
    assert 'n10-n00' not in path  # La vía A es de oeste a este.
    blocked = 'n00-n10'
    edge = network.edges[blocked]
    network.edges[blocked] = replace(edge, allowed=False)
    network.outgoing[edge.source] = [item for item in network.outgoing[edge.source] if item.id != blocked]
    _, alternate = network.shortest_path('n00', 'n10')
    assert blocked not in alternate


def test_finished_simulation_counts_each_side_and_load_only_once():
    simulation = Simulation(seed=4)
    simulation.start()
    simulation.tick(1000)
    result = simulation.snapshot()
    assert result['status'] == 'completed'
    assert result['summary']['visited'] == 24
    assert result['summary']['pending'] == result['summary']['in_progress'] == 0
    assert all(5 <= task['collected_kg'] <= 8 for task in result['tasks'])
    assert all(task['started_at'] and task['completed_at'] for task in result['tasks'])
    assert result['summary']['collected_kg'] == sum(truck['collected_kg'] for truck in result['trucks'])
    assert result['summary']['collected_kg'] == sum(task['collected_kg'] for task in result['tasks'])
    assert all(truck['collected_kg'] <= truck['capacity_kg'] for truck in result['trucks'])
    simulation.tick(1000)
    assert simulation.snapshot() == result


def test_pause_freezes_positions_load_and_elapsed_time():
    simulation = Simulation(seed=3)
    simulation.start()
    simulation.tick(.5)
    assert any(task.state == 'in_progress' for task in simulation.tasks.values())
    simulation.pause()
    paused = simulation.snapshot()
    simulation.tick(20)
    assert simulation.snapshot() == paused
    simulation.start()
    simulation.tick(1)
    assert simulation.snapshot()['elapsed_seconds'] > paused['elapsed_seconds']


def test_infeasible_capacity_preserves_previous_session():
    simulation = Simulation()
    simulation.start()
    simulation.tick(2)
    previous = simulation.snapshot()
    with pytest.raises(ValueError, match='capacidad'):
        simulation.reset(8)
    assert simulation.snapshot() == previous


@pytest.mark.parametrize('path,body', [('start', None), ('pause', None), ('reset', {'capacity_kg': 64}), ('speed', {'speed': 2})])
def test_citizens_cannot_mutate_simulation(path, body):
    simulation = Simulation()
    app = create_app(Settings(operator_token='test-only-token'), simulation, auto_tick=False)
    with TestClient(app) as client:
        assert client.get('/api/network').status_code == 200
        before = client.get('/api/simulation').json()
        assert client.post(f'/api/simulation/{path}', json=body).status_code == 401
        assert client.get('/api/simulation').json() == before


def test_api_operator_controls_and_validation():
    simulation = Simulation(seed=5)
    app = create_app(Settings(operator_token='test-only-token'), simulation, auto_tick=False)
    headers = {'X-Operator-Token': 'test-only-token'}
    with TestClient(app) as client:
        assert client.post('/api/operator/session', headers=headers).status_code == 200
        assert client.post('/api/simulation/start', headers=headers).json()['status'] == 'running'
        simulation.tick(3)
        assert client.post('/api/simulation/pause', headers=headers).json()['status'] == 'paused'
        assert client.post('/api/simulation/speed', headers=headers, json={'speed': 3}).status_code == 422
        assert client.post('/api/simulation/reset', headers=headers, json={'capacity_kg': -1}).status_code == 422
        assert client.post('/api/simulation/reset', headers=headers, json={'capacity_kg': 8}).status_code == 409
        result = client.post('/api/simulation/reset', headers=headers, json={'capacity_kg': 40}).json()
        assert result['status'] == 'ready'
        assert result['summary']['collected_kg'] == 0
        assert result['summary']['pending'] == 24
        assert all(truck['capacity_kg'] == 40 for truck in result['trucks'])


def test_missing_operator_configuration_never_enables_writes():
    app = create_app(Settings(operator_token=''), auto_tick=False)
    with TestClient(app) as client:
        assert client.post('/api/simulation/start').status_code == 503
