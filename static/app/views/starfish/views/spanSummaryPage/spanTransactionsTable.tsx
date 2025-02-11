import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import * as qs from 'query-string';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import Truncate from 'sentry/components/truncate';
import {Series} from 'sentry/types/echarts';
import {formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import {P95_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Sparkline, {
  generateHorizontalLine,
} from 'sentry/views/starfish/components/sparkline';
import type {Span} from 'sentry/views/starfish/queries/types';
import {
  ApplicationMetrics,
  useApplicationMetrics,
} from 'sentry/views/starfish/queries/useApplicationMetrics';
import {
  SpanTransactionMetrics,
  useSpanTransactionMetrics,
} from 'sentry/views/starfish/queries/useSpanTransactionMetrics';
import {useSpanTransactionMetricSeries} from 'sentry/views/starfish/queries/useSpanTransactionMetricSeries';
import {useSpanTransactions} from 'sentry/views/starfish/queries/useSpanTransactions';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {
  DurationTrendCell,
  TimeSpentCell,
} from 'sentry/views/starfish/views/spanSummaryPage/spanBaselineTable';

type Row = {
  count: number;
  metricSeries: Record<string, Series>;
  metrics: SpanTransactionMetrics;
  transaction: string;
};

type Props = {
  span: Span;
  onClickTransaction?: (row: Row) => void;
  openSidebar?: boolean;
};

export type Keys = 'transaction' | 'epm()' | 'p95(transaction.duration)' | 'timeSpent';
export type TableColumnHeader = GridColumnHeader<Keys>;

export function SpanTransactionsTable({span, openSidebar, onClickTransaction}: Props) {
  const location = useLocation();
  const {data: applicationMetrics} = useApplicationMetrics();

  const {data: spanTransactions, isLoading} = useSpanTransactions(span);
  const {data: spanTransactionMetrics} = useSpanTransactionMetrics(
    span,
    spanTransactions.map(row => row.transaction)
  );
  const {data: spanTransactionMetricsSeries} = useSpanTransactionMetricSeries(
    span,
    spanTransactions.map(row => row.transaction)
  );

  const spanTransactionsWithMetrics = spanTransactions.map(row => {
    return {
      ...row,
      timeSpent: formatPercentage(
        spanTransactionMetrics[row.transaction]?.['sum(span.self_time)'] /
          applicationMetrics['sum(span.duration)']
      ),
      metrics: spanTransactionMetrics[row.transaction],
      metricSeries: spanTransactionMetricsSeries[row.transaction],
    };
  });

  const renderHeadCell = (column: TableColumnHeader) => {
    return <span>{column.name}</span>;
  };

  const renderBodyCell = (column: TableColumnHeader, row: Row) => {
    return (
      <BodyCell
        span={span}
        column={column}
        row={row}
        openSidebar={openSidebar}
        onClickTransactionName={onClickTransaction}
        applicationMetrics={applicationMetrics}
      />
    );
  };

  return (
    <GridEditable
      isLoading={isLoading}
      data={spanTransactionsWithMetrics}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
      location={location}
    />
  );
}

type CellProps = {
  column: TableColumnHeader;
  row: Row;
  span: Span;
  onClickTransactionName?: (row: Row) => void;
  openSidebar?: boolean;
};

function BodyCell({
  span,
  column,
  row,
  openSidebar,
  applicationMetrics,
  onClickTransactionName,
}: CellProps & {applicationMetrics: ApplicationMetrics}) {
  if (column.key === 'transaction') {
    return (
      <TransactionCell
        span={span}
        row={row}
        column={column}
        openSidebar={openSidebar}
        onClickTransactionName={onClickTransactionName}
      />
    );
  }

  if (column.key === 'p95(transaction.duration)') {
    return (
      <DurationTrendCell
        duration={row.metrics?.p50}
        color={P95_COLOR}
        durationSeries={row.metricSeries?.p50}
      />
    );
  }

  if (column.key === 'epm()') {
    return <EPMCell span={span} row={row} column={column} />;
  }

  if (column.key === 'timeSpent') {
    return (
      <TimeSpentCell
        formattedTimeSpent={row[column.key]}
        totalAppTime={applicationMetrics['sum(span.duration)']}
        totalSpanTime={row.metrics?.total_time}
      />
    );
  }

  return <span>{row[column.key]}</span>;
}

function TransactionCell({span, column, row}: CellProps) {
  return (
    <Fragment>
      <Link
        to={`/starfish/span/${encodeURIComponent(span.group_id)}?${qs.stringify({
          transaction: row.transaction,
        })}`}
      >
        <Truncate value={row[column.key]} maxLength={75} />
      </Link>
    </Fragment>
  );
}

function EPMCell({row}: CellProps) {
  const theme = useTheme();
  const epm = row.metrics?.spm;
  const epmSeries = row.metricSeries?.spm;

  return (
    <Fragment>
      {epmSeries ? (
        <Sparkline
          color={THROUGHPUT_COLOR}
          series={epmSeries}
          markLine={
            epm ? generateHorizontalLine(`${epm.toFixed(2)}`, epm, theme) : undefined
          }
        />
      ) : null}
    </Fragment>
  );
}

const COLUMN_ORDER: TableColumnHeader[] = [
  {
    key: 'transaction',
    name: 'In Endpoint',
    width: 500,
  },
  {
    key: 'epm()',
    name: 'Throughput (TPM)',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p95(transaction.duration)',
    name: DataTitles.p95,
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'timeSpent',
    name: DataTitles.timeSpent,
    width: COL_WIDTH_UNDEFINED,
  },
];
