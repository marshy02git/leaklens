import React from 'react';
import { View, Text } from 'react-native';
import { VictoryChart, VictoryLine, VictoryTheme, VictoryAxis } from 'victory';
import Svg from 'react-native-svg';

type Props = {
    data: { x: string; y: number }[];
  };
  
  export default function FlowRateChart({ data }: Props) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ color: 'white', fontSize: 18, marginBottom: 10 }}>Flow Rate Over Time</Text>
        <Svg width={350} height={300}>
          <VictoryChart width={350} height={300} theme={VictoryTheme.material}>
            <VictoryAxis
              dependentAxis
              tickFormat={(y) => `${y} L/m`}
              style={{ tickLabels: { fill: 'white' }, axis: { stroke: 'white' } }}
            />
            <VictoryAxis
              tickFormat={(x) => `${x}`}
              style={{ tickLabels: { fill: 'white' }, axis: { stroke: 'white' } }}
            />
            <VictoryLine
              data={data}
              interpolation="natural"
              style={{
                data: { stroke: '#0bfffe', strokeWidth: 2 },
              }}
            />
          </VictoryChart>
        </Svg>
      </View>
    );
  }
